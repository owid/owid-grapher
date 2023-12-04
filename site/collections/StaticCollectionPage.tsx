import React from "react"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"

export interface StaticCollectionPageProps {
    title: string
    charts: string[]
    introduction: string
}

export const StaticCollectionPage = (
    props: StaticCollectionPageProps & { baseUrl: string }
) => {
    const { baseUrl, title, charts, introduction } = props

    return (
        <html>
            <Head
                canonicalUrl={`${baseUrl}/shared-collection/top-charts`}
                pageTitle={title}
                pageDesc={introduction}
                baseUrl={baseUrl}
            />
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <main className="collections-page grid grid-cols-12-full-width">
                    <header className="collections-page__header grid grid-cols-12-full-width span-cols-14">
                        <h1 className="display-2-semibold span-cols-12 col-start-2 collection-title">
                            {title}
                        </h1>
                        <p className="span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 body-1-regular collection-explanation">
                            {introduction}
                        </p>
                    </header>
                    <div className="grid span-cols-12 col-start-2">
                        <div className="grid span-cols-12">
                            {charts.map((chartSlug) => (
                                <figure
                                    key={chartSlug}
                                    data-grapher-src={`${baseUrl}/grapher/${chartSlug}`}
                                    className="span-cols-6 span-md-cols-12"
                                />
                            ))}
                        </div>
                    </div>
                </main>
                <SiteFooter hideDonate={true} baseUrl={baseUrl} />
            </body>
        </html>
    )
}
