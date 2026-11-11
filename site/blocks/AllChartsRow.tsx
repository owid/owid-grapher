import cx from "clsx"
import { Highlight } from "react-instantsearch"
import {
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    SearchChartViewHit,
} from "@ourworldindata/types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLocationDot } from "@fortawesome/free-solid-svg-icons"
import { makeLabelForGrapherTab } from "@ourworldindata/grapher"
import { constructThumbnailUrlForTab } from "../search/SearchChartHitSmallHelpers.js"

interface AllChartsRowProps {
    hit: SearchChartViewHit
    isSelected: boolean
    displayedTab: GrapherTabName | undefined
    thumbnailTabs: GrapherTabName[]
    countries: string[]
    inlinePreviewId?: string
    onTitleSelect: () => void
    onThumbnailSelect: (tab: GrapherTabName) => void
}

export function AllChartsRow({
    hit,
    isSelected,
    displayedTab,
    thumbnailTabs,
    countries,
    inlinePreviewId,
    onTitleSelect,
    onThumbnailSelect,
}: AllChartsRowProps) {
    const selectStateProps = inlinePreviewId
        ? {
              "aria-expanded": isSelected,
              "aria-controls": isSelected ? inlinePreviewId : undefined,
          }
        : { "aria-pressed": isSelected }

    return (
        <div
            className={cx("all-charts-row", {
                "all-charts-row--selected": isSelected,
            })}
        >
            <button
                type="button"
                className="all-charts-row__select"
                {...selectStateProps}
                onClick={onTitleSelect}
            >
                <span className="all-charts-row__heading">
                    <span className="all-charts-row__title">
                        <Highlight
                            hit={hit}
                            attribute="title"
                            highlightedTagName="strong"
                        />
                    </span>
                    {hit.variantName && (
                        <span className="all-charts-row__variant">
                            {hit.variantName}
                        </span>
                    )}
                </span>
                {hit.source && (
                    <span className="all-charts-row__source">
                        <strong>Source:</strong> {hit.source}
                    </span>
                )}
                {countries.length > 0 && (
                    <span className="all-charts-row__countries">
                        <FontAwesomeIcon icon={faLocationDot} />{" "}
                        {countries.join(", ")}
                    </span>
                )}
            </button>
            {thumbnailTabs.length > 0 && (
                <ul className="all-charts-row__thumbnails">
                    {thumbnailTabs.map((tab) => (
                        <li key={tab}>
                            <button
                                type="button"
                                className={cx("all-charts-row__thumbnail", {
                                    "all-charts-row__thumbnail--selected":
                                        tab === displayedTab,
                                })}
                                aria-label={makeLabelForGrapherTab(tab, {
                                    format: "long",
                                })}
                                aria-pressed={tab === displayedTab}
                                onClick={() => onThumbnailSelect(tab)}
                            >
                                <img
                                    src={constructThumbnailUrlForTab({
                                        hit,
                                        tab,
                                        entities: countries,
                                        hasScatter:
                                            tab ===
                                            GRAPHER_TAB_NAMES.ScatterPlot,
                                    })}
                                    loading="lazy"
                                    alt=""
                                />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
