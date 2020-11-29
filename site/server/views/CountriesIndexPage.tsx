import * as React from "react"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"

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
                    <ul>
                        {countries.map((country) => (
                            <li key={country.code}>
                                <img
                                    className="flag"
                                    src={`/images/flags/${country.code}.svg`}
                                />
                                <a href={`/country/${country.slug}`}>
                                    {country.name}
                                </a>
                            </li>
                        ))}
                    </ul>
                </main>
                <SiteFooter baseUrl={baseUrl} />
                {/* <script>{`window.runChartsIndexPage()`}</script> */}
            </body>
        </html>
    )
}
