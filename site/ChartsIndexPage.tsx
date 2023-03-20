import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { ChartListItemVariant } from "./ChartListItemVariant.js"
import * as lodash from "lodash"
import { TableOfContents } from "./TableOfContents.js"
import { slugify } from "@ourworldindata/utils"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"
import { BAKED_BASE_URL } from "../settings/serverSettings.js"
import { EXPLORERS_ROUTE_FOLDER } from "../explorer/ExplorerConstants.js"

export interface ChartIndexItem {
    id: number
    title: string
    slug: string
    variantName?: string
    tags: { id: number; name: string }[]
}

export interface TagWithCharts {
    id: number
    name: string
    charts: ChartIndexItem[]
}

export const ChartsIndexPage = (props: {
    explorers: ExplorerProgram[]
    chartItems: ChartIndexItem[]
    baseUrl: string
}) => {
    const { explorers, chartItems, baseUrl } = props

    const EXPLORERS_ID = "explorers"
    const EXPLORERS_TITLE = "Explorers"
    const CHARTS_ID = "charts"

    const allTags = lodash.sortBy(
        lodash.uniqBy(
            lodash.flatten(chartItems.map((item) => item.tags)),
            (tag) => tag.id
        ),
        (tag) => tag.name
    ) as TagWithCharts[]

    for (const chartItem of chartItems) {
        for (const tag of allTags) {
            if (tag.charts === undefined) tag.charts = []

            if (chartItem.tags.some((t) => t.id === tag.id))
                tag.charts.push(chartItem)
        }
    }

    // Sort the charts in each tag
    for (const tag of allTags) {
        tag.charts = lodash.sortBy(tag.charts, (c) => c.title.trim())
    }

    const pageTitle = "Explorers & Charts"
    const tocEntries = [
        {
            isSubheading: false,
            slug: EXPLORERS_ID,
            text: EXPLORERS_TITLE,
        },
        {
            isSubheading: false,
            slug: CHARTS_ID,
            text: "Charts",
        },
    ]
    tocEntries.push(
        ...allTags.map((t) => {
            return {
                isSubheading: true,
                slug: slugify(t.name),
                text: t.name,
            }
        })
    )

    return (
        <html>
            <Head
                canonicalUrl={`${baseUrl}/charts`}
                pageTitle="Charts"
                pageDesc="All of the interactive charts on Our World in Data."
                baseUrl={baseUrl}
            />
            <body className="ChartsIndexPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <div className="page with-sidebar">
                        <div className="content-wrapper">
                            <TableOfContents
                                headings={tocEntries}
                                pageTitle={pageTitle}
                            />
                            <div className="offset-content">
                                <div className="content">
                                    <header className="chartsHeader">
                                        <input
                                            type="search"
                                            className="chartsSearchInput"
                                            placeholder="Filter interactive charts by title"
                                        />
                                    </header>
                                    <section id="explorers-section">
                                        <h2 id={EXPLORERS_ID}>
                                            {EXPLORERS_TITLE}
                                        </h2>
                                        <ul>
                                            {explorers.map(
                                                ({
                                                    title,
                                                    explorerTitle,
                                                    slug,
                                                }) => (
                                                    <li key={slug}>
                                                        <a
                                                            href={`${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${slug}`}
                                                        >
                                                            {explorerTitle ??
                                                                title}
                                                        </a>
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    </section>
                                    <a id={CHARTS_ID} />
                                    {allTags.map((t) => (
                                        <section key={t.id}>
                                            <h2 id={slugify(t.name)}>
                                                {t.name}
                                            </h2>
                                            <ul>
                                                {t.charts.map((c) => (
                                                    <ChartListItemVariant
                                                        key={c.slug}
                                                        chart={c}
                                                    />
                                                ))}
                                            </ul>
                                        </section>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
                <SiteFooter baseUrl={baseUrl} />
                <script
                    type="module"
                    dangerouslySetInnerHTML={{
                        __html: `
                        window.runChartsIndexPage()
                        runTableOfContents(${JSON.stringify({
                            headings: tocEntries,
                            pageTitle,
                        })})`,
                    }}
                />
            </body>
        </html>
    )
}
