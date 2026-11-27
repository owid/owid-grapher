import * as React from "react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import cx from "clsx"
import { match } from "ts-pattern"
import { useIntersectionObserver, useMediaQuery } from "usehooks-ts"
import {
    IconDefinition,
    faExclamationTriangle,
    faSearch,
    faLocationDot,
} from "@fortawesome/free-solid-svg-icons"
import { Button } from "@ourworldindata/components"
import {
    type AllChartsBlockHit,
    ChartRecordType,
    GRAPHER_PREVIEW_CLASS,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    ChartLabelMode,
    GrapherVariant,
    type GrapherQueryParams,
} from "@ourworldindata/types"
import { queryParamsToStr, Url } from "@ourworldindata/utils"
import { GrapherWithFallback } from "../GrapherWithFallback.js"
import { MultiDimEmbed } from "../MultiDimEmbed.js"
import { useDocumentContext } from "../gdocs/DocumentContext.js"
import { useMobxStateToReactState } from "../hooks.js"
import { MEDIUM_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import {
    constructChartUrl,
    constructPreviewUrl,
} from "../search/searchUtils.js"
import { SearchHorizontalDivider } from "../search/SearchHorizontalDivider.js"
import { SearchNoResults } from "../search/SearchNoResults.js"
import { toAllChartsBlockGrapherParams } from "./allChartsBlockEntitySelection.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    GuidedChartContext,
    applyGuidedChartQueryParams,
    makeLabelForGrapherTab,
    type GrapherState,
    type GuidedChartContextValue,
    type GuidedChartMultiDimRegistration,
    type ImageRequest,
} from "@ourworldindata/grapher"

const SKELETON_ROW_COUNT = 6
const MAX_THUMBNAILS = 3
const PREVIEW_GRAPHER_CONFIG = { enableKeyboardShortcuts: false }
const MULTI_DIM_PREVIEW_GRAPHER_CONFIG = {
    ...PREVIEW_GRAPHER_CONFIG,
    hideExploreTheDataButton: true,
}
const DATA_EXPLORER_PREVIEW_GRAPHER_CONFIG = {
    ...PREVIEW_GRAPHER_CONFIG,
    hideExploreTheDataButton: false,
}
const ALL_CHARTS_BLOCK_THUMBNAIL_REQUEST: ImageRequest = {
    variant: GrapherVariant.Thumbnail,
    labelMode: ChartLabelMode.Names,
    size: { kind: "explicit", fontSize: 18 },
    includeDetails: false,
}

interface AllChartsBlockSelection {
    fetchedQuery: string
    id: string
    tab?: GrapherTabName
}

export function AllChartsBlockResults({
    status,
    hits,
    countries,
    fetchedQuery,
    onLoadMore,
    isLoadingMore,
    noResultsHref,
}: {
    status?: "pending" | "error"
    hits: AllChartsBlockHit[]
    countries: string[]
    fetchedQuery: string
    onLoadMore?: () => void
    isLoadingMore?: boolean
    noResultsHref: string
}): React.ReactElement {
    if (status === "pending") return <AllChartsBlockResultsSkeleton />
    if (status === "error")
        return <AllChartsBlockErrorMessage searchHref={noResultsHref} />
    if (hits.length === 0)
        return (
            <AllChartsBlockNoResults
                hasQuery={fetchedQuery !== ""}
                searchHref={noResultsHref}
            />
        )
    return (
        <AllChartsBlockResultsGrid
            fetchedQuery={fetchedQuery}
            hits={hits}
            countries={countries}
            onLoadMore={onLoadMore}
            isLoadingMore={isLoadingMore}
        />
    )
}

function AllChartsBlockResultsGrid({
    fetchedQuery,
    hits,
    countries,
    onLoadMore,
    isLoadingMore,
}: {
    fetchedQuery: string
    hits: AllChartsBlockHit[]
    countries: string[]
    onLoadMore?: () => void
    isLoadingMore?: boolean
}): React.ReactElement {
    const [storedSelection, setSelection] = useState<AllChartsBlockSelection>()
    const selection =
        storedSelection?.fetchedQuery === fetchedQuery
            ? storedSelection
            : undefined

    const selectedHit =
        hits.find((hit) => hit.objectID === selection?.id) ?? hits[0]
    const selectedTab =
        selection?.tab ??
        getDefaultTab(pickThumbnailTabs(selectedHit.availableTabs), countries)

    const isNarrow = useMediaQuery(MEDIUM_BREAKPOINT_MEDIA_QUERY, {
        initializeWithValue: false,
    })
    const preview = useAllChartsBlockPreviewControl()

    const appliedQueryRef = useRef(fetchedQuery)
    useEffect(() => {
        if (appliedQueryRef.current === fetchedQuery) return
        appliedQueryRef.current = fetchedQuery
        preview.apply(
            selectedHit,
            toAllChartsBlockGrapherParams({
                tab: selectedTab,
                countries,
                target: "preview",
            })
        )
    })

    const onSelect = (
        hit: AllChartsBlockHit,
        tab: GrapherTabName | undefined
    ): void => {
        setSelection({ fetchedQuery, id: hit.objectID, tab })
        if (hit === selectedHit && tab)
            preview.apply(
                hit,
                toAllChartsBlockGrapherParams({
                    tab,
                    countries,
                    target: "preview",
                })
            )
    }

    return (
        <GuidedChartContext.Provider value={preview.contextValue}>
            <div className="all-charts-block-results grid grid-cols-12">
                <AllChartsBlockList
                    key={fetchedQuery}
                    hits={hits}
                    countries={countries}
                    selectedHit={selectedHit}
                    selectedTab={selectedTab}
                    previewTab={preview.activeTab}
                    isNarrow={isNarrow}
                    onSelect={onSelect}
                    onLoadMore={onLoadMore}
                    isLoadingMore={isLoadingMore}
                />
                {!isNarrow && (
                    <div className="all-charts-block-results__preview span-cols-7">
                        <AllChartsBlockPreview
                            hit={selectedHit}
                            tab={selectedTab}
                            countries={countries}
                        />
                    </div>
                )}
            </div>
        </GuidedChartContext.Provider>
    )
}

function AllChartsBlockList({
    hits,
    countries,
    selectedHit,
    selectedTab,
    previewTab,
    isNarrow,
    onSelect,
    onLoadMore,
    isLoadingMore,
}: {
    hits: AllChartsBlockHit[]
    countries: string[]
    selectedHit: AllChartsBlockHit
    selectedTab: GrapherTabName
    previewTab?: GrapherTabName
    isNarrow: boolean
    onSelect: (hit: AllChartsBlockHit, tab: GrapherTabName | undefined) => void
    onLoadMore?: () => void
    isLoadingMore?: boolean
}): React.ReactElement {
    const [listElement, setListElement] = useState<HTMLUListElement | null>(
        null
    )
    const { ref: sentinelRef } = useIntersectionObserver({
        root: listElement,
        onChange: (isIntersecting) => {
            if (isIntersecting) onLoadMore?.()
        },
    })

    return (
        <div className="all-charts-block-results__list-wrapper span-cols-5 span-md-cols-12">
            <ul className="all-charts-block-results__list" ref={setListElement}>
                {hits.map((hit) => {
                    const isSelected = hit.objectID === selectedHit.objectID
                    return (
                        <AllChartsBlockListItem
                            key={hit.objectID}
                            hit={hit}
                            countries={countries}
                            selectedTab={isSelected ? selectedTab : undefined}
                            previewTab={isSelected ? previewTab : undefined}
                            isNarrow={isNarrow}
                            onSelect={(tab) => onSelect(hit, tab)}
                        />
                    )
                })}
                {onLoadMore && (
                    <li
                        className="all-charts-block-results__sentinel"
                        ref={sentinelRef}
                        aria-hidden
                    />
                )}
            </ul>
            {onLoadMore && (
                <SearchHorizontalDivider
                    className="all-charts-block-results__show-more"
                    hasButton
                    isLoading={isLoadingMore}
                    onClick={onLoadMore}
                />
            )}
        </div>
    )
}

function AllChartsBlockListItem({
    hit,
    countries,
    selectedTab,
    previewTab,
    isNarrow,
    onSelect,
}: {
    hit: AllChartsBlockHit
    countries: string[]
    selectedTab?: GrapherTabName
    previewTab?: GrapherTabName
    isNarrow: boolean
    onSelect: (tab: GrapherTabName | undefined) => void
}): React.ReactElement {
    const isSelected = selectedTab !== undefined
    const itemRef = useRef<HTMLLIElement>(null)
    const inlinePreviewId = useId()
    const thumbnailTabs = pickThumbnailTabs(hit.availableTabs)
    const thumbnails: AllChartsBlockThumbnail[] = thumbnailTabs.map((tab) => ({
        tab,
        grapherParams: toAllChartsBlockGrapherParams({
            tab,
            countries,
            target: "thumbnail",
        }),
    }))

    const select = (
        tab: GrapherTabName | undefined,
        scrollTarget: HTMLElement | null
    ): void => {
        if (!isNarrow) return onSelect(tab)
        flushSync(() => onSelect(tab))
        scrollTarget?.scrollIntoView({ block: "start" })
    }

    return (
        <li
            className={cx("all-charts-block-results__item", {
                "all-charts-block-results__item--selected": isSelected,
            })}
            ref={itemRef}
        >
            <AllChartsBlockRow
                hit={hit}
                isSelected={isSelected}
                displayedTab={previewTab ?? selectedTab}
                thumbnails={thumbnails}
                countries={countries}
                inlinePreviewId={isNarrow ? inlinePreviewId : undefined}
                onTitleSelect={() => {
                    if (!isSelected) select(undefined, itemRef.current)
                }}
                onThumbnailSelect={select}
            />
            {isNarrow && selectedTab !== undefined && (
                <div
                    className="all-charts-block-results__inline-preview"
                    id={inlinePreviewId}
                >
                    <AllChartsBlockPreview
                        hit={hit}
                        tab={selectedTab}
                        countries={countries}
                    />
                </div>
            )}
        </li>
    )
}

interface AllChartsBlockThumbnail {
    tab: GrapherTabName
    grapherParams: GrapherQueryParams
}

interface AllChartsBlockRowProps {
    hit: AllChartsBlockHit
    isSelected: boolean
    displayedTab?: GrapherTabName
    thumbnails: AllChartsBlockThumbnail[]
    countries: string[]
    inlinePreviewId?: string
    onTitleSelect: () => void
    onThumbnailSelect: (tab: GrapherTabName, thumbnail: HTMLElement) => void
}

function AllChartsBlockRow({
    hit,
    isSelected,
    displayedTab,
    thumbnails,
    countries,
    inlinePreviewId,
    onTitleSelect,
    onThumbnailSelect,
}: AllChartsBlockRowProps): React.ReactElement {
    const selectStateProps = inlinePreviewId
        ? {
              "aria-expanded": isSelected,
              "aria-controls": isSelected ? inlinePreviewId : undefined,
              "aria-disabled": isSelected,
          }
        : { "aria-current": isSelected }

    return (
        <div
            className={cx("all-charts-block-row", {
                "all-charts-block-row--selected": isSelected,
            })}
        >
            <a
                className="all-charts-block-row__select"
                href={constructChartUrl({ hit })}
                {...selectStateProps}
                onClick={(event) => {
                    event.preventDefault()
                    onTitleSelect()
                }}
            >
                <span className="all-charts-block-row__heading">
                    <span className="all-charts-block-row__title">
                        {hit.title}
                    </span>
                    {hit.variantName && (
                        <span className="all-charts-block-row__variant">
                            {hit.variantName}
                        </span>
                    )}
                </span>
                {hit.source && (
                    <span className="all-charts-block-row__source">
                        <strong>Source:</strong> {hit.source}
                    </span>
                )}
                {countries.length > 0 && (
                    <span className="all-charts-block-row__countries">
                        <FontAwesomeIcon icon={faLocationDot} />{" "}
                        {countries.join(", ")}
                    </span>
                )}
            </a>
            {thumbnails.length > 0 && (
                <ul className="all-charts-block-row__thumbnails">
                    {thumbnails.map(({ tab, grapherParams }) => (
                        <li key={tab}>
                            <button
                                type="button"
                                className={cx(
                                    "all-charts-block-row__thumbnail",
                                    {
                                        "all-charts-block-row__thumbnail--selected":
                                            tab === displayedTab,
                                    }
                                )}
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
                                            ALL_CHARTS_BLOCK_THUMBNAIL_REQUEST,
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

function AllChartsBlockResultsSkeleton(): React.ReactElement {
    return (
        <div className="all-charts-block-results grid grid-cols-12">
            <div className="all-charts-block-results__list-wrapper span-cols-5 span-md-cols-12">
                <ul className="all-charts-block-results__list animate-pulse">
                    {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                        <li
                            className="all-charts-block-results__item all-charts-block-results__skeleton-row"
                            key={index}
                        >
                            <div className="all-charts-block-results__skeleton-title" />
                            <div className="all-charts-block-results__skeleton-source" />
                            <div className="all-charts-block-results__skeleton-thumbnail" />
                            {index === 0 && (
                                <div className="all-charts-block-results__skeleton-inline-preview" />
                            )}
                        </li>
                    ))}
                </ul>
            </div>
            <div className="all-charts-block-results__preview all-charts-block-results__skeleton-preview animate-pulse span-cols-7 span-md-cols-12" />
        </div>
    )
}

function AllChartsBlockErrorMessage({
    searchHref,
}: {
    searchHref: string
}): React.ReactElement {
    return (
        <AllChartsBlockMessage
            icon={faExclamationTriangle}
            heading="We couldn't load the charts on this topic."
            text="Try reloading the page, or search all our charts."
            href={searchHref}
        />
    )
}

function AllChartsBlockNoResults({
    hasQuery,
    searchHref,
}: {
    hasQuery: boolean
    searchHref: string
}): React.ReactElement {
    return (
        <AllChartsBlockMessage
            icon={faSearch}
            heading={
                hasQuery
                    ? "There are no results for this query."
                    : "There are no charts on this topic yet."
            }
            text={
                hasQuery
                    ? "Try searching for something else or searching all our charts."
                    : "Search all our charts instead."
            }
            href={searchHref}
        />
    )
}

function AllChartsBlockMessage({
    icon,
    heading,
    text,
    href,
}: {
    icon: IconDefinition
    heading: string
    text: string
    href: string
}): React.ReactElement {
    return (
        <div className="all-charts-block-results all-charts-block-results--message">
            <SearchNoResults
                heading={heading}
                subtitle={
                    <>
                        <p className="body-3-medium">{text}</p>
                        <Button
                            className="all-charts-block-results__search-button"
                            theme="solid-vermillion"
                            text="Search all charts"
                            href={href}
                            icon={faSearch}
                            iconPosition="left"
                        />
                    </>
                }
                icon={icon}
            />
        </div>
    )
}

function AllChartsBlockPreview({
    hit,
    tab,
    countries,
}: {
    hit: AllChartsBlockHit
    tab: GrapherTabName
    countries: string[]
}): React.ReactElement {
    const { isPreviewing } = useDocumentContext()
    const grapherParams = toAllChartsBlockGrapherParams({
        tab,
        countries,
        target: "preview",
    })
    return match(hit)
        .with({ type: ChartRecordType.Chart }, (chartHit) => (
            <GrapherWithFallback
                slug={chartHit.slug}
                queryStr={queryParamsToStr(grapherParams)}
                className={GRAPHER_PREVIEW_CLASS}
                isEmbeddedInAnOwidPage
                isEmbeddedInADataPage={false}
                config={PREVIEW_GRAPHER_CONFIG}
                isPreviewing={isPreviewing}
            />
        ))
        .with({ type: ChartRecordType.MultiDimView }, (viewHit) => {
            const url = Url.fromURL(
                constructChartUrl({ hit: viewHit, grapherParams })
            ).updateQueryParams({ hideControls: "true" }).fullUrl
            return (
                <MultiDimEmbed
                    key={viewHit.objectID}
                    url={url}
                    chartConfig={
                        viewHit.isDataExplorer
                            ? DATA_EXPLORER_PREVIEW_GRAPHER_CONFIG
                            : MULTI_DIM_PREVIEW_GRAPHER_CONFIG
                    }
                    isPreviewing={isPreviewing}
                />
            )
        })
        .exhaustive()
}

function getDefaultTab(
    thumbnailTabs: GrapherTabName[],
    countries: string[]
): GrapherTabName {
    const preferredTab =
        countries.length > 0
            ? thumbnailTabs.find((tab) => tab !== GRAPHER_TAB_NAMES.WorldMap)
            : undefined
    return preferredTab ?? thumbnailTabs[0] ?? GRAPHER_TAB_NAMES.Table
}

function pickThumbnailTabs(availableTabs: GrapherTabName[]): GrapherTabName[] {
    return availableTabs
        .filter((tab) => tab !== GRAPHER_TAB_NAMES.Table)
        .slice(0, MAX_THUMBNAILS)
}

function useAllChartsBlockPreviewControl(): {
    contextValue: GuidedChartContextValue
    activeTab: GrapherTabName | undefined
    apply: (hit: AllChartsBlockHit, grapherParams: GrapherQueryParams) => void
} {
    const [grapherState, setGrapherState] = useState<GrapherState | null>(null)
    const multiDimRef = useRef<GuidedChartMultiDimRegistration | null>(null)

    const contextValue = useMemo<GuidedChartContextValue>(
        () => ({
            registerGrapherState: (state) => {
                setGrapherState(state)
                return () => {
                    multiDimRef.current = null
                    setGrapherState((current) =>
                        current === state ? null : current
                    )
                }
            },
            registerMultiDim: (registration) => {
                multiDimRef.current = registration
            },
        }),
        []
    )

    const activeTab = useMobxStateToReactState(
        useCallback(
            () =>
                grapherState?.isConfigReady
                    ? grapherState.activeTab
                    : undefined,
            [grapherState]
        )
    )

    const apply = (
        hit: AllChartsBlockHit,
        grapherParams: GrapherQueryParams
    ): void => {
        if (!grapherState) return
        applyGuidedChartQueryParams({
            grapherState,
            multiDim: multiDimRef.current ?? undefined,
            queryParams: Url.fromURL(constructChartUrl({ hit, grapherParams }))
                .queryParams,
        })
    }

    return { contextValue, activeTab, apply }
}
