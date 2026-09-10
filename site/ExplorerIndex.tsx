import { useState } from "react"
import { faHeartBroken } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

// A card on the /explorers index page: either an actual explorer or a
// multi-dim data page whose config declares `presentation.type: "data-explorer"`.
export interface ExplorerIndexItem {
    slug: string
    title: string
    subtitle: string
    href: string
    thumbnailUrl: string
}

function ExplorerIndexPageCard(props: { item: ExplorerIndexItem }) {
    const { item } = props
    const [hasError, setHasError] = useState(false)
    return (
        <li key={item.slug}>
            <a className="explorer-index-page__card" href={item.href}>
                {!hasError ? (
                    <img
                        width="850"
                        height="600"
                        loading="lazy"
                        onError={() => setHasError(true)}
                        src={item.thumbnailUrl}
                    />
                ) : (
                    <div className="explorer-index-page__card-error">
                        <FontAwesomeIcon icon={faHeartBroken} />
                        <span>Explorer preview not available</span>
                    </div>
                )}
                <h2>{item.title}</h2>
                <p>{item.subtitle}</p>
            </a>
        </li>
    )
}

export interface ExplorerIndexPageProps {
    baseUrl: string
    items: ExplorerIndexItem[]
}

export function ExplorerIndex(props: ExplorerIndexPageProps) {
    const { items } = props
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
                {items.map((item) => (
                    <ExplorerIndexPageCard item={item} key={item.slug} />
                ))}
            </ul>
        </>
    )
}

export const __OWID_EXPLORER_INDEX_PAGE_PROPS =
    "__OWID_EXPLORER_INDEX_PAGE_PROPS"
