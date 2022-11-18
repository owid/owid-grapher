import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { sortBy, groupBy } from "@ourworldindata/utils"
import SearchCountry from "./SearchCountry.js"
import {
    WorldRegionToProjection,
    WorldRegionName,
} from "@ourworldindata/grapher"

interface Country {
    name: string
    slug: string
    code: string
}

export const CountriesIndexPage = (props: {
    countries: Country[]
    baseUrl: string
}) => {
    const { countries, baseUrl } = props

    const countriesWithContinent = sortBy(countries, (c) => c.name)
        .map((country) => ({
            ...country,
            continent: WorldRegionToProjection[
                country.name as WorldRegionName
            ] as any,
        }))
        .filter((c) => c)
        .map((country) => ({
            ...country,
            continent: country.continent.replace(/[A-Z]/g, " $&").trim(),
        }))

    const grouped = groupBy(countriesWithContinent, (c) => c.continent)

    return (
        <html>
            <Head
                canonicalUrl={`${baseUrl}/countries`}
                pageTitle="Countries"
                pageDesc="Data by individual country on Our World in Data."
                baseUrl={baseUrl}
            />
            <body className="CountriesIndexPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <h1>Data by country</h1>
                    <div className="article-content">
                        <div
                            className="wp-block-search-country-profile"
                            data-project="co2"
                        />
                        <br />
                        <ul className="covid-country-tiles">
                            <li>
                                <a href="https://ourworldindata.org/co2/country/united-states?country=~USA">
                                    United States
                                </a>
                            </li>
                            <li>
                                <a href="https://ourworldindata.org/co2/country/united-kingdom?country=~GBR">
                                    United Kingdom
                                </a>
                            </li>
                            <li>
                                <a href="https://ourworldindata.org/co2/country/china?country=~CHN">
                                    China
                                </a>
                            </li>
                            <li>
                                <a href="https://ourworldindata.org/co2/country/india?country=~IND">
                                    India
                                </a>
                            </li>
                            <li>
                                <a href="https://ourworldindata.org/co2/country/brazil?country=~BRA">
                                    Brazil
                                </a>
                            </li>
                            <li>
                                <a href="https://ourworldindata.org/co2/country/south-africa?country=~ZAF">
                                    South Africa
                                </a>
                            </li>
                            <li>
                                <a href="https://ourworldindata.org/co2/country/germany?country=~DEU">
                                    Germany
                                </a>
                            </li>
                            <li>
                                <a href="https://ourworldindata.org/co2/country/spain?country=~ESP">
                                    Spain
                                </a>
                            </li>
                            <li>
                                <a href="https://ourworldindata.org/co2/country/france?country=~FRA">
                                    France
                                </a>
                            </li>
                            <li>
                                <a href="https://ourworldindata.org/co2/country/canada?country=~CAN">
                                    Canada
                                </a>
                            </li>
                            <li>
                                <a href="https://ourworldindata.org/co2/country/australia?country=~AUS">
                                    Australia
                                </a>
                            </li>
                            <li>
                                <a href="https://ourworldindata.org/co2/country/sweden?country=~SWE">
                                    Sweden
                                </a>
                            </li>
                        </ul>
                    </div>
                    {sortBy(Object.entries(grouped), ([cont]) => cont).map(
                        ([cont, countries]) => (
                            <div key={cont}>
                                <h2>{cont}</h2>
                                <ul>
                                    {countries.map((country) => (
                                        <li key={country.code}>
                                            <img
                                                className="flag"
                                                src={`/images/flags/${country.code}.svg`}
                                            />
                                            <a
                                                href={`/country/${country.slug}`}
                                            >
                                                {country.name}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )
                    )}
                </main>
                <SiteFooter baseUrl={baseUrl} />
                <script>{`window.runSiteFooterScripts()`}</script>
            </body>
        </html>
    )
}
