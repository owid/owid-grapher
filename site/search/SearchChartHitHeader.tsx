import cx from "classnames"
import { Highlight } from "react-instantsearch"
import { getIndexName } from "./searchClient.js"
import { SearchChartHit, SearchIndexName } from "./searchTypes.js"

interface SearchChartHitHeaderProps {
    hit: SearchChartHit
    url: string
    source?: string
    isLarge?: boolean
    onClick?: () => void
}

export function SearchChartHitHeader({
    hit,
    url,
    source,
    isLarge = false,
    onClick,
}: SearchChartHitHeaderProps) {
    return (
        <a
            className={cx("search-chart-hit-header", {
                "search-chart-hit-header--large": isLarge,
            })}
            href={url}
            onClick={onClick}
            data-algolia-index={getIndexName(
                SearchIndexName.ExplorerViewsMdimViewsAndCharts
            )}
            data-algolia-object-id={hit.objectID}
            data-algolia-position={hit.__position}
        >
            <header className="search-chart-hit-header__content-wrapper">
                {isLarge && (
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
