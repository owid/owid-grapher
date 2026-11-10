import cx from "clsx"
import {
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    SearchChartUrlTarget,
} from "@ourworldindata/types"
import { makeLabelForGrapherTab } from "@ourworldindata/grapher"
import { constructChartAndPreviewUrlsForTab } from "../search/SearchChartHitSmallHelpers.js"

const THUMBNAIL_WIDTH_PX = 158
const THUMBNAIL_HEIGHT_PX = 84
const MAX_THUMBNAILS = 3

export interface TextPart {
    text: string
    isMatched: boolean
}

export interface AllChartsRowData extends SearchChartUrlTarget {
    titleParts: TextPart[]
    variantName?: string
    sourcesLine?: string
    availableTabs: GrapherTabName[]
}

interface AllChartsRowProps {
    row: AllChartsRowData
    isSelected: boolean
    selectedTab?: GrapherTabName
    countries: string[]
    onSelect: (tab: GrapherTabName) => void
}

export function AllChartsRow({
    row,
    isSelected,
    selectedTab,
    countries,
    onSelect,
}: AllChartsRowProps) {
    const thumbnailTabs = pickThumbnailTabs(row.availableTabs, {
        hasCountries: countries.length > 0,
    })

    const displayedTab =
        isSelected && selectedTab && thumbnailTabs.includes(selectedTab)
            ? selectedTab
            : thumbnailTabs[0]

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
                    onClick={() =>
                        onSelect(displayedTab ?? GRAPHER_TAB_NAMES.Table)
                    }
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
                    {row.sourcesLine && (
                        <span className="all-charts-row__source">
                            <strong>Source:</strong> {row.sourcesLine}
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
                                        width={THUMBNAIL_WIDTH_PX}
                                        height={THUMBNAIL_HEIGHT_PX}
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

function pickThumbnailTabs(
    availableTabs: GrapherTabName[],
    { hasCountries }: { hasCountries: boolean }
): GrapherTabName[] {
    const tabs = availableTabs
        .filter((tab) => tab !== GRAPHER_TAB_NAMES.Table)
        .slice(0, MAX_THUMBNAILS)

    if (
        hasCountries &&
        tabs.length > 1 &&
        tabs[0] === GRAPHER_TAB_NAMES.WorldMap
    )
        return [...tabs.slice(1), tabs[0]]

    return tabs
}
