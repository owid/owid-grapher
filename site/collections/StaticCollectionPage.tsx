import cx from "classnames"
import { Head } from "../Head.js"
import { GRAPHER_PREVIEW_CLASS } from "@ourworldindata/types"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import GrapherImage from "../GrapherImage.js"
import { Html } from "../Html.js"

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
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/shared-collection/top-charts`}
                pageTitle={title}
                pageDesc={introduction}
                baseUrl={baseUrl}
            />
            <body>
                <SiteHeader />
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
                            {charts.map((chartSlug) => {
                                const grapherUrl = `${baseUrl}/grapher/${chartSlug}`
                                return (
                                    <figure
                                        key={chartSlug}
                                        className={cx(
                                            GRAPHER_PREVIEW_CLASS,
                                            "span-cols-6 span-md-cols-12"
                                        )}
                                        data-grapher-src={grapherUrl}
                                    >
                                        <a href={grapherUrl} rel="noopener">
                                            <GrapherImage slug={chartSlug} />
                                        </a>
                                    </figure>
                                )
                            })}
                        </div>
                    </div>
                </main>
                <SiteFooter hideDonate />
            </body>
        </Html>
    )
}
