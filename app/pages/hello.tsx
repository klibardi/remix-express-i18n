import { Link, useLoaderData, useMatches, type MetaFunction } from "@remix-run/react";
import t, { rr } from "~/translations/index";
import { I18nLink, r } from "~/translations/index";

export const meta: MetaFunction = (all) => {
  console.log(all);
  console.log(rr((all.matches[0].data as any).i18n.locale, all.location.pathname))
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Hello() {
  const matches = useMatches();
  const data = matches[0].data as any;

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-16">
        <header className="flex flex-col items-center gap-9">
          <h1 className="leading text-2xl font-bold text-gray-800 dark:text-gray-100">
            {t(data.i18n.locale, "Hello World!")}{" "}
            <span className="sr-only">Remix</span>
          </h1>
        </header>
        <nav className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-gray-200 p-6 dark:border-gray-700">
          <p className="leading-6 text-gray-700 dark:text-gray-200">
            {t(data.i18n.locale, `What's next?`)}
            For English press one..<br/>
            <Link to="/en/hello">Hello in english (Link)</Link><br />
            <Link to="/pl/witaj">Hello in Polish (Link)</Link><br />
            <br />
            <a href="/en/hello">Hello in english (a)</a><br />
            <a href="/pl/witaj">Hello in Polish (a)</a><br />
            <br />
            <I18nLink to={r(data.i18n, 'en')`/hello`}>Hello in english (i18n)</I18nLink><br />
            <I18nLink to={r(data.i18n, 'pl')`/hello`}>Hello in polish (i18n)</I18nLink><br />
            <I18nLink to={r(data.i18n)`/hello`}>Hello in default (i18n)</I18nLink><br />
            <br />
          </p>
        </nav>
      </div>
    </div>
  );
}
