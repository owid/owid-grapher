import * as settings from 'settings'
import * as React from 'react'
import { Head } from './Head'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

export interface Country {
    name: string
    slug: string
}

export const CountriesIndexPage = (props: { countries: Country[] }) => {
    const { countries } = props

    return <html>
        <Head canonicalUrl={`${settings.BAKED_BASE_URL}/charts`} pageTitle="Charts" pageDesc="All of the interactive charts on Our World in Data."/>
        <body className="CountriesIndexPage">
            <SiteHeader/>
            <main>
                <ul>
                    {countries.map(country => <li>
                        <a href={`/country/${country.slug}`}>{country.name}</a>
                    </li>)}
                </ul>
            </main>
            <SiteFooter/>
            {/* <script>{`window.runChartsIndexPage()`}</script> */}
        </body>
    </html>
}