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
            href={url}
            onClick={onClick}
            data-algolia-index={getIndexName(
                SearchIndexName.ExplorerViewsMdimViewsAndCharts
            )}
            data-algolia-object-id={hit.objectID}
            data-algolia-position={hit.__position}
        >
            <header className="search-chart-hit-header">
                <div className="search-chart-hit-header__title-container">
                    <h3 className="search-chart-hit-header__title">
                        {hit.title}
                    </h3>
                    {source && (
                        <span className="search-chart-hit-header__source">
                            {source}
                        </span>
                    )}
                </div>
                <Highlight
                    hit={hit}
                    attribute="subtitle"
                    highlightedTagName="strong"
                    classNames={{ root: "search-chart-hit-header__subtitle" }}
                />
            </header>
        </a>
    )
}
