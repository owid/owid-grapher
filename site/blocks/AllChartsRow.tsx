import cx from "clsx"
import {
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    SearchChartUrlTarget,
} from "@ourworldindata/types"
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
    selectedTab?: GrapherTabName
    thumbnailTabs: GrapherTabName[]
    countries: string[]
    onSelect: (tab?: GrapherTabName) => void
}

export function AllChartsRow({
    row,
    isSelected,
    selectedTab,
    thumbnailTabs,
    countries,
    onSelect,
}: AllChartsRowProps) {
    const displayedTab = isSelected ? selectedTab : thumbnailTabs[0]

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
                    aria-pressed={isSelected}
                    onClick={() => onSelect(displayedTab)}
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
                                    onClick={() => onSelect(tab)}
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
