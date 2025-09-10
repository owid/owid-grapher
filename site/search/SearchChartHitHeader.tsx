import { getIndexName } from "./searchClient.js"
import { SearchChartHit, SearchIndexName } from "./searchTypes.js"
import { Highlight } from "react-instantsearch"

interface SearchChartHitHeaderProps {
    hit: SearchChartHit
    url: string
    source?: { text: string; url: string }
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
        <header className="search-chart-hit-header">
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
                    <a
                        href={url}
                        onClick={onClick}
                        data-algolia-index={getIndexName(
                            SearchIndexName.ExplorerViewsMdimViewsAndCharts
                        )}
                        data-algolia-object-id={hit.objectID}
                        data-algolia-position={hit.__position}
                    >
                        <h3 className="search-chart-hit-header__title">
                            {hit.title}
                        </h3>
                    </a>

                    {source?.text && (
                        <a
                            className="search-chart-hit-header__source search-chart-hit-header__source--desktop"
                            href={source.url}
                        >
                            Source: {source.text}
                        </a>
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
                {source?.text && (
                    <a
                        className="search-chart-hit-header__source search-chart-hit-header__source--mobile"
                        href={source.url}
                    >
                        Source: {source.text}
                    </a>
                )}
            </div>
        </header>
    )
}
