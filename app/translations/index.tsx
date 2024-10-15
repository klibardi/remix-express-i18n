import rPl from "~/i18n-route-translations/pl.json";
import rEn from "~/i18n-route-translations/en.json";
import pl from "./pl";
import en from "./en";
import { PropsWithChildren } from "react";
import { Link } from "@remix-run/react";

const locales = {
  pl,
  en,
};

const routeLocales = {
  pl: rPl as Record<string, string>,
  en: rEn as Record<string, string>,
};

const reversedRouteLocales = Object.fromEntries([...Object.entries(routeLocales)].map(([loc, mapping]) => {
  const acc: Record<string, string> = {};
  for (const [k, v] of Object.entries(mapping)) {
    acc[v] = k;
  }
  return [loc, acc];
}));

export default function t(
  loc: keyof typeof locales,
  s: string,
  ...args: any[]
): string {
  const l = locales[loc];
  if (!l) {
    console.warn(`Unsupported locale "${loc}"`);
    return s;
  }
  const f = (l as any)[s];
  if (!f) {
    console.warn(`Missing translation for "${s}" in locale "${loc}"`);
    return s;
  }
  const res = f(...args);
  return res;
}

export function r(i18n: {
  locale: string;
  defaultLocale: string;
}, forceLocale?: string): (strings: TemplateStringsArray, ...values: any[]) => [string, boolean] {
  return (strings, ...values) => {
    forceLocale = forceLocale || i18n.defaultLocale;
    const mappedStrings: string[] = [];
    for (const s of strings) {
      const chunks = s.split("/");
      const chunksTranslated = [];
      for (const c of chunks) {
        if (routeLocales[forceLocale as keyof typeof routeLocales][c]) {
          chunksTranslated.push(
            routeLocales[forceLocale as keyof typeof routeLocales][c],
          );
        } else {
          chunksTranslated.push(c);
        }
      }
      mappedStrings.push(chunksTranslated.join("/"));
    }
    let result = "";
    for (let i = 0; i < values.length; i++) {
      result += mappedStrings[i];
      result += values[i];
    }
    result += mappedStrings[mappedStrings.length - 1];
    let navigationIsOutOfSpaBounds = false;
    if (forceLocale !== i18n.defaultLocale) {
      result = `/${forceLocale}${result.startsWith("/") ? "" : "/"}${result}`;
      navigationIsOutOfSpaBounds = true;
    }
    if (forceLocale !== i18n.locale) {
      navigationIsOutOfSpaBounds = true;
    }
    return [result, navigationIsOutOfSpaBounds];
  };
}

export function rr(fromLocale: keyof typeof locales, path: string): string {
  const lookup = reversedRouteLocales[fromLocale];
    const chunks = path.split("/");
    const chunksTranslated = [];
    for (const c of chunks) {
      if (lookup[c]) {
        chunksTranslated.push(
          lookup[c],
        );
      } else {
        chunksTranslated.push(c);
      }
    }
    return chunksTranslated.join("/");
}

export function I18nLink({
  to,
  children,
}: PropsWithChildren<{ to: [string, boolean] }>) {
  const [href, useAnchorTag] = to;
  if (useAnchorTag) {
    return <Link reloadDocument to={href}>{children}</Link>;
  } else {
    return <Link to={href}>{children}</Link>;
  }
}
