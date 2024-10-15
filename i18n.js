import { createRequestHandler } from "@remix-run/express";
import fs from "fs/promises";
import path from "path";
import serveStatic from "serve-static";
import { walk } from "@root/walk";

const buildKnownStatics = async (prefix, root) => {
  const knownStatics = new Set();
  await walk(root, async (err, pathname, dirent) => {
    if (!dirent.isDirectory()) {
      knownStatics.add(`${prefix}/${path.relative(root, pathname)}`);
    }
  });
  return knownStatics;
};

const buildHandlersForLocale = async (
  buildDir,
  locale,
  { mode, getLoadContext: providedGetLoadContext },
) => {
  const handler = createRequestHandler({
    build: await import(`./${buildDir}/${locale}/server/index.js`),
    getLoadContext: async (req, res, next) => ({
      i18n: res.locals.i18n,
    }),
  });
  const _static = serveStatic(`${buildDir}/${locale}/client`, {
    maxAge: 3_600_000,
  });
  const knownStatics = await buildKnownStatics(
    `/${locale}`,
    `${buildDir}/${locale}/client`,
  );
  const defaultHandler = createRequestHandler({
    build: await import(`./${buildDir}/${locale}-default/server/index.js`),
    getLoadContext: async (req, res) => ({
      ...(await providedGetLoadContext(req, res)),
      i18n: res.locals.i18n,
    }),
    mode,
  });
  const defaultKnownStatics = await buildKnownStatics(
    "",
    `${buildDir}/${locale}-default/client`,
  );
  const defaultStatic = serveStatic(`${buildDir}/${locale}-default/client`, {
    maxAge: 3_600_000,
  });
  return {
    prefix: `/${locale}/`,
    handler,
    static: _static,
    knownStatics,
    defaultHandler,
    defaultKnownStatics,
    defaultStatic,
  };
};

const buildHandlersForLocales = async (
  buildDir,
  locales,
  { mode, getLoadContext },
) => {
  const localized = [];
  const defaults = {};
  for (const locale of locales) {
    const {
      prefix,
      handler,
      static: _static,
      knownStatics,
      defaultHandler,
      defaultKnownStatics,
      defaultStatic,
    } = await buildHandlersForLocale(buildDir, locale, {
      mode,
      getLoadContext,
    });
    localized.push({ prefix, handler, static: _static, knownStatics });
    defaults[locale] = {
      handler: defaultHandler,
      static: defaultStatic,
      knownStatics: defaultKnownStatics,
    };
  }
  const redirectPrefixes = new Set([...locales].map((l) => `/${l}`));
  for (const [loc, { handler }] of Object.entries(defaults)) {
    defaults[loc].handler = (req, res) => {
      if (redirectPrefixes.has(req.originalUrl)) {
        res.redirect(`${req.originalUrl}/`);
      } else {
        handler(req, res);
      }
    };
  }
  return {
    localized,
    defaults: defaults,
    availableLocales: [...Object.keys(defaults)],
  };
};

export const createI18nRemixHandler = async (
  buildDir,
  { checkHeader, fallbackLocale, getUserPreference, getAllowedLocales },
  { mode, getLoadContext },
) => {
  const builds = new Set(await fs.readdir(buildDir));
  const nonDefaultBuilds = new Set(
    [...builds].filter((b) => b.split("-").length === 1),
  );
  for (const ndb of nonDefaultBuilds) {
    if (!builds.has(`${ndb}-default`)) {
      throw new Error(
        `Invalid build. For "${ndb}" no "${ndb}-default" was found.`,
      );
    }
  }
  const { localized, defaults, availableLocales } =
    await buildHandlersForLocales(buildDir, nonDefaultBuilds, {
      mode,
      getLoadContext,
    });
  return async (req, res, next) => {
    const _fallbackLocale = await fallbackLocale(req, res);
    const availableLocalesLookup = new Set(availableLocales);
    const scopedAllowedLocales = [...new Set([...(await getAllowedLocales(req, res)), _fallbackLocale])];
    const allowedLocales = scopedAllowedLocales || [...Object.keys(defaults)]
    const validAllowedLocales = allowedLocales.filter((l) => availableLocalesLookup.has(l));
    const validAllowedLocalesLookup = new Set(validAllowedLocales);
    let validHeaderPreference;
    if (await checkHeader(req, res)) {
      const headerPreference = req.acceptsLanguages([...Object.keys(defaults)]);
      validHeaderPreference = validAllowedLocalesLookup.has(headerPreference) ? headerPreference : null;
    } else {
      validHeaderPreference = null;
    }
    const userPreference = await getUserPreference(req, res);
    const validUserPreference = validAllowedLocalesLookup.has(userPreference)
      ? userPreference
      : null;
    for (const loc of localized) {
      if (validAllowedLocales.length === 0 || validAllowedLocales.length == 1) {
        // if there is only fallback locale or one allowed locale do not handle the
        // /<locale>/... paths
        break;
      }
      if (req.originalUrl.startsWith(loc.prefix)) {
        console.log(req.originalUrl, loc.prefix);
        const { handler, knownStatics, static: _static } = loc;
        res.locals.build = loc.prefix.replace(/\//g, "");
        if (knownStatics.has(req.originalUrl)) {
          res.locals.realUrl = req.originalUrl;
          Object.defineProperty(req, "originalUrl", {
            value: req.originalUrl.replace(loc.prefix, "/"),
          });
          req.url = req.originalUrl;
          _static(req, res, next);
        } else {
          res.locals.i18n = {
            availableLocales: validAllowedLocales.length === 0 ? [_fallbackLocale] : validAllowedLocales,
            fallbackLocale: _fallbackLocale,
            locale: loc.prefix.replace(/\//g, ""),
            defaultLocale:
              validUserPreference || validHeaderPreference || _fallbackLocale,
            explanation: "url-prefix",
            userPreference,
          };
          handler(req, res, next);
        }
        return;
      }
    }
    if (validUserPreference) {
      const {
        handler,
        knownStatics,
        static: _static,
      } = defaults[validUserPreference];
      res.locals.build = `${validUserPreference}-default`;
      if (knownStatics.has(req.originalUrl)) {
        res.locals.realUrl = req.originalUrl;
        req.url = req.originalUrl;
        _static(req, res, next);
      } else {
        res.locals.i18n = {
          availableLocales: validAllowedLocales.length === 0 ? [_fallbackLocale] : validAllowedLocales,
          fallbackLocale: _fallbackLocale,
          locale: validUserPreference,
          defaultLocale: validUserPreference,
          explanation: "user-preference",
          userPreference,
        };
        handler(req, res, next);
      }
      return;
    }
    if (validHeaderPreference) {
      const {
        handler,
        knownStatics,
        static: _static,
      } = defaults[validHeaderPreference];
      res.locals.build = `${validHeaderPreference}-default`;
      if (knownStatics.has(req.originalUrl)) {
        res.locals.realUrl = req.originalUrl;
        req.url = req.originalUrl;
        _static(req, res, next);
      } else {
        res.locals.i18n = {
          availableLocales: validAllowedLocales.length === 0 ? [_fallbackLocale] : validAllowedLocales,
          fallbackLocale: _fallbackLocale,
          locale: validHeaderPreference,
          defaultLocale: validHeaderPreference,
          explanation: "accept-language-header",
          userPreference,
        };
        handler(req, res, next);
      }
      return;
    }
    const {
      handler,
      knownStatics,
      static: _static,
    } = defaults[_fallbackLocale];
    res.locals.build = `${_fallbackLocale}-default`;
    if (knownStatics.has(req.originalUrl)) {
      res.locals.realUrl = req.originalUrl;
      req.url = req.originalUrl;
      _static(req, res, next);
    } else {
      res.locals.i18n = {
        availableLocales: validAllowedLocales.length === 0 ? [_fallbackLocale] : validAllowedLocales,
        fallbackLocale: _fallbackLocale,
        locale: _fallbackLocale,
        defaultLocale: _fallbackLocale,
        explanation: "fallback-locale",
        userPreference,
      };
      handler(req, res, next);
    }
    return;
  };
};
