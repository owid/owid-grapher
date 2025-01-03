import { useState } from "react"
import { MinimalExplorerInfo } from "@ourworldindata/types"
import { EXPLORER_DYNAMIC_THUMBNAIL_URL } from "../settings/clientSettings.js"
import { faHeartBroken } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"

function ExplorerIndexPageCard(props: {
    baseUrl: string
    explorer: MinimalExplorerInfo
}) {
    const { baseUrl, explorer } = props
    const [hasError, setHasError] = useState(false)
    return (
        <li key={explorer.slug}>
            <a
                className="explorer-index-page__card"
                href={`${baseUrl}/${EXPLORERS_ROUTE_FOLDER}/${explorer.slug}`}
            >
                {!hasError ? (
                    <img
                        width="850"
                        height="600"
                        loading="lazy"
                        onError={() => setHasError(true)}
                        src={`${EXPLORER_DYNAMIC_THUMBNAIL_URL}/${explorer.slug}.png`}
                    />
                ) : (
                    <div className="explorer-index-page__card-error">
                        <FontAwesomeIcon icon={faHeartBroken} />
                        <span>Explorer preview not available</span>
                    </div>
                )}
                <h2>{explorer.title}</h2>
                <p>{explorer.subtitle}</p>
            </a>
        </li>
    )
}

export interface ExplorerIndexPageProps {
    baseUrl: string
    explorers: MinimalExplorerInfo[]
}

export function ExplorerIndex(props: ExplorerIndexPageProps) {
    const { baseUrl, explorers } = props
    return (
        <>
            <header className="explorer-index-page__header grid grid-cols-12-full-width span-cols-14">
                <h1 className="h1-semibold span-cols-12 col-start-2 collection-title">
                    Data Explorers
                </h1>
                <p className="span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 body-2-regular collection-explanation">
                    Our data explorers gather many indicators together to
                    provide comprehensive overviews of their topics.
                </p>
            </header>
            <ul className="explorer-index-page-list span-cols-12 col-start-2 grid grid-cols-4 grid-md-cols-2 grid-sm-cols-1">
                {explorers.map((explorer) => (
                    <ExplorerIndexPageCard
                        baseUrl={baseUrl}
                        explorer={explorer}
                        key={explorer.slug}
                    />
                ))}
            </ul>
        </>
    )
}

export const __OWID_EXPLORER_INDEX_PAGE_PROPS =
    "__OWID_EXPLORER_INDEX_PAGE_PROPS"
