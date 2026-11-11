import cx from "clsx"
import {
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    SearchChartUrlTarget,
} from "@ourworldindata/types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLocationDot } from "@fortawesome/free-solid-svg-icons"
import { makeLabelForGrapherTab } from "@ourworldindata/grapher"
import { constructChartAndPreviewUrlsForTab } from "../search/SearchChartHitSmallHelpers.js"

export interface TextPart {
    text: string
    isMatched: boolean
}

export interface AllChartsRowData extends SearchChartUrlTarget {
    titleParts: TextPart[]
    variantName?: string
    source?: string
    availableTabs: GrapherTabName[]
}

interface AllChartsRowProps {
    row: AllChartsRowData
    isSelected: boolean
    displayedTab: GrapherTabName | undefined
    thumbnailTabs: GrapherTabName[]
    countries: string[]
    inlinePreviewId?: string
    onTitleSelect: (tab?: GrapherTabName) => void
    onThumbnailSelect: (tab: GrapherTabName) => void
}

export function AllChartsRow({
    row,
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
            <div className="all-charts-row__header">
                <button
                    type="button"
                    className="all-charts-row__select"
                    {...selectStateProps}
                    onClick={() => onTitleSelect(displayedTab)}
                >
                    <span className="all-charts-row__heading">
                        <span className="all-charts-row__title">
                            {row.titleParts.map((part, index) =>
                                part.isMatched ? (
                                    <strong key={index}>{part.text}</strong>
                                ) : (
                                    <span key={index}>{part.text}</span>
                                )
                            )}
                        </span>
                        {row.variantName && (
                            <span className="all-charts-row__variant">
                                {row.variantName}
                            </span>
                        )}
                    </span>
                    {row.source && (
                        <span className="all-charts-row__source">
                            <strong>Source:</strong> {row.source}
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
                                        src={
                                            constructChartAndPreviewUrlsForTab({
                                                hit: row,
                                                tab,
                                                entities: countries,
                                                hasScatter:
                                                    tab ===
                                                    GRAPHER_TAB_NAMES.ScatterPlot,
                                            }).previewUrl
                                        }
                                        loading="lazy"
                                        alt=""
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
