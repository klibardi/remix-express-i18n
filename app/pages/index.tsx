import { useMatches, type MetaFunction } from "@remix-run/react";
import t from "~/translations/index";
import { r, I18nLink } from "~/translations/index";

export const meta: MetaFunction = (all) => {
  console.log(all);
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Hello() {
  const matches = useMatches();
  const data = matches[0].data as any

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-16">
        <header className="flex flex-col items-center gap-9">
          <h1 className="leading text-2xl font-bold text-gray-800 dark:text-gray-100">
            {t(data.i18n.locale, "remix-express-i18n")}{" "}
          </h1>
        </header>
        <nav className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-gray-200 p-6 dark:border-gray-700">
          <p className="leading-6 text-gray-700 dark:text-gray-200">
            {t(data.i18n.locale, `What's next?`)}
            <I18nLink to={r(data.i18n)`/hello`}>Hello...</I18nLink>
          </p>
        </nav>
      </div>
    </div>
  );
}
