import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

const i18nRouteTranslations = path.join(
  process.cwd(),
  "app",
  "i18n-route-translations",
);
const i18nRoutesSource = path.join(process.cwd(), "app", "_routes");
const routesSource = path.join(process.cwd(), "app", "routes");
const buildSource = path.join(process.cwd(), "build");
const buildTarget = path.join(process.cwd(), "i18n-builds");
const allRoutes = (await fs.readdir(i18nRoutesSource)).filter(
  (r) => !r.endsWith(".json"),
);

let locales = new Set();
for (const route of allRoutes) {
  const loc = route.split(".")[0];
  locales.add(loc);
}

const DEBUG_LOG = false;
const logDebug = (...args) => {
  if (DEBUG_LOG) {
    console.log(...args);
  }
};
const DEBUG_ERROR = true;
const logError = (...args) => {
  if (DEBUG_ERROR) {
    console.error(...args);
  }
};

const lookups = {};
for (const fname of (await fs.readdir(i18nRouteTranslations)).filter((f) =>
  f.endsWith(".json"),
)) {
  const lookup = JSON.parse(
    await fs.readFile(path.join(i18nRouteTranslations, fname)),
  );
  const loc = fname.split(".")[0];
  lookups[loc] = lookup;
}

await fs.rm(routesSource, { recursive: true, force: true });
await fs.rm(buildSource, { recursive: true, force: true });
await fs.rm(buildTarget, { recursive: true, force: true });
await fs.mkdir(routesSource, { recursive: true });
await fs.mkdir(buildSource, { recursive: true });
await fs.mkdir(buildTarget, { recursive: true });
console.log(`Building locales...`);
for (const locale of locales) {
  process.stdout.write(`  - "${locale}"... `);
  await fs.mkdir(routesSource, { recursive: true });
  const rewriteMap = [];
  const matchingRoutes = allRoutes.filter((r) => r.startsWith(`${locale}.`));
  for (const r of matchingRoutes) {
    const chunks = r.split(".");
    const loc = chunks[0];
    const lookup = lookups[loc] || {};
    const rewrittenChunks = chunks.map((chunk) => {
      if (lookup[chunk]) {
        return lookup[chunk];
      } else {
        return chunk;
      }
    });
    const rewrittenRoute = rewrittenChunks.join(".");
    rewriteMap.push([r, rewrittenRoute]);
  }

  for (const mr of matchingRoutes) {
    const [loc, ...chunks2] = mr.split(".");
    if (loc !== locale) {
      continue;
    }
    const rewrittenChunks2 = chunks2.map((chunk) => {
      if (lookups[locale][chunk]) {
        return lookups[locale][chunk];
      } else {
        return chunk;
      }
    });
    const rewrittenRoute2 = rewrittenChunks2.join(".");
    rewriteMap.push([mr, rewrittenRoute2]);
  }

  for (const [src, dest] of rewriteMap) {
    await fs.cp(
      path.join(i18nRoutesSource, src),
      path.join(routesSource, dest),
    );
  }

  await new Promise((resolve, reject) => {
    const builder = spawn("npm", ["run", "build"], {
      env: { ...process.env, BASE: `/${locale}/` },
    });
    builder.stdout.on("data", (chunk) => logDebug(chunk.toString("utf-8")));
    builder.stderr.on("data", (chunk) => logError(chunk.toString("utf-8")));
    builder.on("error", (e) => {
      logError(e);
      reject(e);
    });
    builder.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(code);
      }
    });
  });
  await fs.cp(buildSource, path.join(buildTarget, locale), { recursive: true });
  await fs.rm(buildSource, { recursive: true, force: true });

  await new Promise((resolve, reject) => {
    const builder = spawn("npm", ["run", "build"], {
      env: { ...process.env, BASE: '/' },
    });
    builder.stdout.on("data", (chunk) => logDebug(chunk.toString("utf-8")));
    builder.stderr.on("data", (chunk) => logError(chunk.toString("utf-8")));
    builder.on("error", (e) => {
      logError(e);
      reject(e);
    });
    builder.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(code);
      }
    });
  });
  await fs.cp(buildSource, path.join(buildTarget, `${locale}-default`), { recursive: true });
  await fs.rm(buildSource, { recursive: true, force: true });

  await fs.rm(routesSource, { recursive: true, force: true });
  console.log(`OK`);
}
console.log("Done.");
