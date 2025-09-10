import { getIndexName } from "./searchClient.js"
import { SearchChartHit, SearchIndexName } from "./searchTypes.js"
import { Highlight } from "react-instantsearch"

interface SearchChartHitHeaderProps {
    hit: SearchChartHit
    url: string
    source?: string
    onClick?: () => void
}

export function SearchChartHitHeader({
    hit,
    url,
    source,
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
            <header className="search-chart-hit-header__content">
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
                    classNames={{ root: "search-chart-hit-header__subtitle" }}
                />
                {source && (
                    <span className="search-chart-hit-header__source search-chart-hit-header__source--mobile">
                        Source: {source}
                    </span>
                )}
            </header>
        </a>
    )
}
