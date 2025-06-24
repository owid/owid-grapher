import * as _ from "lodash-es"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { Country } from "@ourworldindata/utils"
import { Html } from "./Html.js"

export const CountriesIndexPage = (props: {
    countries: Country[]
    baseUrl: string
}) => {
    const { countries, baseUrl } = props

    const sortedCountries = _.sortBy(countries, (country) => country.name)

    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/countries`}
                pageTitle="Countries"
                pageDesc="Data by individual country on Our World in Data."
                baseUrl={baseUrl}
            />
            <body className="CountriesIndexPage">
                <SiteHeader />
                <main className="wrapper">
                    <h1>Data by country</h1>
                    <ul>
                        {sortedCountries.map((country) => (
                            <li key={country.code}>
                                <a href={`/country/${country.slug}`}>
                                    <img
                                        className="flag"
                                        src={`/images/flags/${country.code}.svg`}
                                        loading="lazy"
                                    />
                                    {country.name}
                                </a>
                            </li>
                        ))}
                    </ul>
                </main>
                <SiteFooter />
            </body>
        </Html>
    )
}
