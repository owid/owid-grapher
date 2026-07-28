import { Head } from "../Head.js"
import { Html } from "../Html.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { SiteFooterContext } from "@ourworldindata/types"
import {
    FEATURED_VIZ_PAGE_ROOT_ID,
    FeaturedVizDashboard,
} from "./FeaturedVizDashboard.js"

export const FeaturedVizPage = ({ baseUrl }: { baseUrl: string }) => {
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/featured-viz`}
                pageTitle="Featured visualizations"
                pageDesc="Custom-built interactive visualizations from the Our World in Data team."
                baseUrl={baseUrl}
                noindex
            />
            <body>
                <SiteHeader />
                <main id={FEATURED_VIZ_PAGE_ROOT_ID}>
                    <FeaturedVizDashboard />
                </main>
                <SiteFooter context={SiteFooterContext.featuredVizPage} />
            </body>
        </Html>
    )
}
