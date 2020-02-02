import * as React from "react"
import * as settings from "settings"
import { Head } from "./Head"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"

export interface Country {
    name: string
    slug: string
    code: string
}

export const CountriesIndexPage = (props: { countries: Country[] }) => {
    const { countries } = props

    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/countries`}
                pageTitle="Countries"
                pageDesc="Data by individual country on Our World in Data."
            />
            <body className="CountriesIndexPage">
                <SiteHeader />
                <main>
                    <h1>Data by country</h1>
                    <ul>
                        {countries.map(country => (
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
                <SiteFooter />
                {/* <script>{`window.runChartsIndexPage()`}</script> */}
            </body>
        </html>
    )
}
