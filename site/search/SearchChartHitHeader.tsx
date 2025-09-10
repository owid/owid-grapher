import { getIndexName } from "./searchClient.js"
import { SearchChartHit, SearchIndexName } from "./searchTypes.js"
import { Highlight } from "react-instantsearch"

interface SearchChartHitHeaderProps {
    hit: SearchChartHit
    url: string
    source?: string
    showLogo?: boolean
    onClick?: () => void
}

export function SearchChartHitHeader({
    hit,
    url,
    source,
    showLogo = false,
    onClick,
}: SearchChartHitHeaderProps) {
    return (
        <a
            className="search-chart-hit-header"
            href={url}
            onClick={onClick}
            data-algolia-index={getIndexName(
                SearchIndexName.ExplorerViewsMdimViewsAndCharts
            )}
            data-algolia-object-id={hit.objectID}
            data-algolia-position={hit.__position}
        >
            <header className="search-chart-hit-header__content-wrapper">
                {showLogo && (
                    <img
                        src="owid-logo.svg"
                        alt="Our World in Data logo"
                        className="search-chart-hit-header__logo"
                        width={104}
                        height={57}
                    />
                )}
                <div className="search-chart-hit-header__content">
                    <div className="search-chart-hit-header__title-container">
                        <h3 className="search-chart-hit-header__title">
                            {hit.title}
                        </h3>
                        {source && (
                            <span className="search-chart-hit-header__source search-chart-hit-header__source--desktop">
                                Source: {source}
                            </span>
                        )}
                    </div>
                    <Highlight
                        hit={hit}
                        attribute="subtitle"
                        highlightedTagName="strong"
                        classNames={{
                            root: "search-chart-hit-header__subtitle",
                        }}
                    />
                    {source && (
                        <span className="search-chart-hit-header__source search-chart-hit-header__source--mobile">
                            Source: {source}
                        </span>
                    )}
                </div>
            </header>
        </a>
    )
}
