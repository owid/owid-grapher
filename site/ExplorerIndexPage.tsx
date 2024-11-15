import React from "react"
import { Head } from "./Head.js"
import { Html } from "./Html.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { MinimalExplorerInfo } from "@ourworldindata/types"
import { EXPLORER_DYNAMIC_THUMBNAIL_URL } from "../settings/clientSettings.js"

interface ExplorerIndexPageProps {
    baseUrl: string
    explorers: MinimalExplorerInfo[]
}

export const ExplorerIndexPage = ({
    baseUrl,
    explorers,
}: ExplorerIndexPageProps) => {
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/${EXPLORERS_ROUTE_FOLDER}`}
                pageTitle={`Data Explorers`}
                pageDesc={"An index of all Our World in Data data explorers"}
                baseUrl={baseUrl}
            ></Head>
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <main className="explorer-index-page grid grid-cols-12-full-width">
                    <header className="explorer-index-page__header grid grid-cols-12-full-width span-cols-14">
                        <h1 className="display-2-semibold span-cols-12 col-start-2 collection-title">
                            Data Explorers
                        </h1>
                        <p className="span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 body-1-regular collection-explanation">
                            Our data explorers gather many indicators together
                            to provide comprehensive overviews of their topics.
                        </p>
                    </header>
                    <ul className="explorer-index-page-list span-cols-12 col-start-2 grid grid-cols-4 grid-md-cols-2 grid-sm-cols-1">
                        {explorers.map((explorer) => (
                            <li key={explorer.slug}>
                                <a
                                    className="explorer-index-page__card"
                                    href={`${baseUrl}/${EXPLORERS_ROUTE_FOLDER}/${explorer.slug}`}
                                >
                                    <img
                                        width="850"
                                        height="600"
                                        loading="lazy"
                                        src={`${EXPLORER_DYNAMIC_THUMBNAIL_URL}/${explorer.slug}.png`}
                                    />
                                    <h2>{explorer.title}</h2>
                                    <p>{explorer.subtitle}</p>
                                </a>
                            </li>
                        ))}
                    </ul>
                </main>
                <SiteFooter baseUrl={baseUrl} />
            </body>
        </Html>
    )
}
