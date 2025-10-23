import { countries } from "@ourworldindata/utils"
import { CountriesIndexPage } from "../site/CountriesIndexPage.js"
import { renderToHtmlPage } from "./siteRenderers.js"

export const countriesIndexPage = (baseUrl: string) =>
    renderToHtmlPage(
        <CountriesIndexPage countries={countries} baseUrl={baseUrl} />
    )
