import { createI18nRemixHandler } from "./i18n.js";
import compression from "compression";
import express from "express";
import morgan from "morgan";

const app = express();

app.disable("x-powered-by");
app.use(compression());
morgan.token("real-url", (req, res) => res.locals.realUrl || req.originalUrl);
morgan.token("build", (req, res) => res.locals.build);
app.use(
  morgan(
    "[:build] :method :real-url :status :res[content-length] :response-time ms",
  ),
);
app.use(
  "*",
  await createI18nRemixHandler(
    "./i18n-builds",
    {
      getAllowedLocales: async (req, res) => ["en"],
      getUserPreference: async (req, res) => "pl",
      checkHeader: async (req, res) => true,
      fallbackLocale: async (req, res) => process.env.FALLBACK_LOCALE,
    },
    {
      getLoadContext: async (req, res) => ({}),
      mode: process.env.NODE_ENV || "development",
    },
  ),
);

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`Express server listening at http://localhost:${port}`),
);
