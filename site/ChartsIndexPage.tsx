import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteFooterContext } from "@ourworldindata/types"
import { ChartsIndexContainer } from "./ChartsIndex.js"

export type ChartsIndexPageProps = {
    baseUrl: string
}

export class ChartsIndexPage extends React.Component<ChartsIndexPageProps> {
    render() {
        const { baseUrl } = this.props
        return (
            <html>
                <Head
                    canonicalUrl={`${baseUrl}/charts`}
                    pageTitle="Charts"
                    pageDesc="All of the interactive charts on Our World in Data."
                    baseUrl={baseUrl}
                />
                <SiteHeader baseUrl={baseUrl} />
                <body className="ChartsIndexPage">
                    <main
                        id="charts-index-container"
                        className="grid grid-cols-12-full-width"
                    >
                        <ChartsIndexContainer />
                    </main>

                    <SiteFooter
                        baseUrl={baseUrl}
                        hideDonationFlag
                        context={SiteFooterContext.chartsIndexPage}
                    />
                </body>
            </html>
        )
    }
}
