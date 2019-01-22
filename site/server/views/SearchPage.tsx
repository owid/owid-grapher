import * as settings from 'settings'
import * as React from 'react'
import { Head } from './Head'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

export const SearchPage = (props: { query: string }) => {
    return <html>
        <Head canonicalUrl={`${settings.BAKED_BASE_URL}/search`} pageTitle="Search" pageDesc="Search articles and charts on Our World in Data."/>
        <body className="SearchPage">
            <SiteHeader/>
            <main>
            </main>
            <SiteFooter/>
            <script>{`window.runSearchPage()`}</script>
        </body>
    </html>
}