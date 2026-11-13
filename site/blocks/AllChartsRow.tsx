import cx from "clsx"
import {
    ChartLabelMode,
    ChartRecordType,
    GrapherTabName,
    GrapherVariant,
    type GrapherQueryParams,
} from "@ourworldindata/types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLocationDot } from "@fortawesome/free-solid-svg-icons"
import {
    makeLabelForGrapherTab,
    type ImageRequest,
} from "@ourworldindata/grapher"
import { constructPreviewUrl } from "../search/searchUtils.js"
import type { AllChartsHit } from "../search/queries.js"

const ALL_CHARTS_THUMBNAIL_REQUEST: ImageRequest = {
    variant: GrapherVariant.Thumbnail,
    labelMode: ChartLabelMode.Names,
    size: { kind: "explicit", fontSize: 18 },
    includeDetails: false,
}

export interface AllChartsThumbnail {
    tab: GrapherTabName
    grapherParams: GrapherQueryParams
}

interface AllChartsRowProps {
    hit: AllChartsHit
    isSelected: boolean
    displayedTab: GrapherTabName
    thumbnails: AllChartsThumbnail[]
    countries: string[]
    inlinePreviewId?: string
    onTitleSelect: () => void
    onThumbnailSelect: (tab: GrapherTabName, thumbnail: HTMLElement) => void
}

export function AllChartsRow({
    hit,
    isSelected,
    displayedTab,
    thumbnails,
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
                        {hit.title}
                        {hit.type === ChartRecordType.MultiDimView &&
                            hit.isDataExplorer && (
                                <span className="all-charts-row__label">
                                    {/* Glues the label to the title's last word */}
                                    &nbsp;Data explorer
                                </span>
                            )}
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
            {thumbnails.length > 0 && (
                <ul className="all-charts-row__thumbnails">
                    {thumbnails.map(({ tab, grapherParams }) => (
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
                                onClick={(event) =>
                                    onThumbnailSelect(tab, event.currentTarget)
                                }
                            >
                                <img
                                    src={constructPreviewUrl({
                                        hit,
                                        grapherParams,
                                        imageRequest:
                                            ALL_CHARTS_THUMBNAIL_REQUEST,
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
