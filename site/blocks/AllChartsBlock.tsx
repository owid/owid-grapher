import * as React from "react"
import { useEffect, useId, useRef, useState } from "react"
import { flushSync } from "react-dom"
import cx from "clsx"
import { useIntersectionObserver, useMediaQuery } from "usehooks-ts"
import {
    IconDefinition,
    faCircleXmark,
    faExclamationTriangle,
    faMagnifyingGlass,
    faSearch,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Button } from "@ourworldindata/components"
import {
    GRAPHER_PREVIEW_CLASS,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
} from "@ourworldindata/types"
import { queryParamsToStr } from "@ourworldindata/utils"
import { GrapherWithFallback } from "../GrapherWithFallback.js"
import { useDocumentContext } from "../gdocs/DocumentContext.js"
import { MEDIUM_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import { toGrapherQueryParams } from "../search/searchUtils.js"
import { SearchHorizontalDivider } from "../search/SearchHorizontalDivider.js"
import { SearchNoResults } from "../search/SearchNoResults.js"
import { AllChartsRow, AllChartsRowData } from "./AllChartsRow.js"

const SKELETON_ROW_COUNT = 6
const MAX_THUMBNAILS = 3
/** Stable reference, since the Grapher refetches its config whenever this object changes */
const PREVIEW_GRAPHER_CONFIG = { enableKeyboardShortcuts: false }

export interface AllChartsBlockSearch {
    /** The input's text */
    query: string
    /** The query the rows currently answer */
    rowsQuery: string
    onQueryChange: (query: string) => void
    placeholder: string
}

interface AllChartsSelection {
    rowsQuery: string
    slug: string
    tab?: GrapherTabName
}

interface AllChartsHeadingProps {
    id: string
    heading: string
    rowCount?: number
}

export function AllChartsBlock({
    id,
    heading,
    rowCount,
    rows,
    onLoadMore,
    isLoadingMore,
    search,
    noResultsHref,
    className,
}: {
    id: string
    heading: string
    rowCount: number
    rows: AllChartsRowData[]
    onLoadMore?: () => void
    isLoadingMore?: boolean
    search?: AllChartsBlockSearch
    noResultsHref: string
    className?: string
}): React.ReactElement {
    const rowsQuery = search?.rowsQuery ?? ""
    const [storedSelection, setSelection] = useState<
        AllChartsSelection | undefined
    >()
    const selection =
        storedSelection?.rowsQuery === rowsQuery ? storedSelection : undefined

    const selectedRow =
        rows.find((row) => row.slug === selection?.slug) ?? rows[0]
    const selectedTab =
        selectedRow &&
        ((selection?.slug === selectedRow.slug && selection.tab) ||
            getDefaultTabForRow(selectedRow, []))

    const isNarrow = useMediaQuery(MEDIUM_BREAKPOINT_MEDIA_QUERY)

    return (
        <section
            className={cx(className, "needs-dividers", "all-charts-block")}
        >
            <AllChartsHeading id={id} heading={heading} rowCount={rowCount} />
            {search && <AllChartsSearchInput search={search} />}
            {rows.length === 0 ? (
                <AllChartsNoResults
                    hasQuery={rowsQuery !== ""}
                    searchHref={noResultsHref}
                />
            ) : (
                <div className="grid grid-cols-12">
                    <AllChartsList
                        // New element per query, so the scroll position resets
                        key={rowsQuery}
                        rows={rows}
                        selectedRow={selectedRow}
                        selectedTab={selectedTab}
                        isNarrow={isNarrow}
                        onSelect={(row, tab) =>
                            setSelection({ rowsQuery, slug: row.slug, tab })
                        }
                        onLoadMore={onLoadMore}
                        isLoadingMore={isLoadingMore}
                    />
                    {!isNarrow && (
                        <div className="all-charts-block__preview span-cols-7">
                            {selectedRow && selectedTab && (
                                <AllChartsPreview
                                    slug={selectedRow.slug}
                                    tab={selectedTab}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}

function AllChartsList({
    rows,
    selectedRow,
    selectedTab,
    isNarrow,
    onSelect,
    onLoadMore,
    isLoadingMore,
}: {
    rows: AllChartsRowData[]
    selectedRow: AllChartsRowData | undefined
    selectedTab: GrapherTabName | undefined
    isNarrow: boolean
    onSelect: (row: AllChartsRowData, tab: GrapherTabName | undefined) => void
    onLoadMore?: () => void
    isLoadingMore?: boolean
}): React.ReactElement {
    const [listElement, setListElement] = useState<HTMLUListElement | null>(
        null
    )
    const { ref: sentinelRef, isIntersecting: isSentinelVisible } =
        useIntersectionObserver({ root: listElement })

    useEffect(() => {
        if (onLoadMore && isSentinelVisible) onLoadMore()
    }, [onLoadMore, isSentinelVisible])

    return (
        <div className="all-charts-block__list-wrapper span-cols-5 span-md-cols-12">
            <ul className="all-charts-block__list" ref={setListElement}>
                {rows.map((row) => (
                    <AllChartsItem
                        key={`${row.type}:${row.slug}:${row.queryParams ?? ""}`}
                        row={row}
                        isSelected={row === selectedRow}
                        selectedTab={selectedTab}
                        isNarrow={isNarrow}
                        onSelect={(tab) => onSelect(row, tab)}
                    />
                ))}
                {onLoadMore && (
                    <li
                        className="all-charts-block__sentinel"
                        ref={sentinelRef}
                        aria-hidden
                    />
                )}
            </ul>
            {onLoadMore && (
                <SearchHorizontalDivider
                    className="all-charts-block__show-more"
                    hasButton
                    isLoading={isLoadingMore}
                    onClick={onLoadMore}
                />
            )}
        </div>
    )
}

function AllChartsItem({
    row,
    isSelected,
    selectedTab,
    isNarrow,
    onSelect,
}: {
    row: AllChartsRowData
    isSelected: boolean
    selectedTab: GrapherTabName | undefined
    isNarrow: boolean
    onSelect: (tab: GrapherTabName | undefined) => void
}): React.ReactElement {
    const itemRef = useRef<HTMLLIElement>(null)
    const inlinePreviewId = useId()

    const select = (
        tab: GrapherTabName | undefined,
        shouldScrollToRow: boolean
    ): void => {
        flushSync(() => onSelect(tab))
        if (isNarrow && shouldScrollToRow)
            itemRef.current?.scrollIntoView({ block: "start" })
    }

    return (
        <li
            className={cx("all-charts-block__item", {
                "all-charts-block__item--selected": isSelected,
            })}
            ref={itemRef}
        >
            <AllChartsRow
                row={row}
                isSelected={isSelected}
                selectedTab={selectedTab}
                thumbnailTabs={pickThumbnailTabs(row.availableTabs, {
                    hasCountries: false,
                })}
                countries={[]}
                inlinePreviewId={isNarrow ? inlinePreviewId : undefined}
                onTitleSelect={(tab) => select(tab, !isSelected)}
                onThumbnailSelect={(tab) => select(tab, true)}
            />
            {isNarrow && isSelected && (
                <div
                    className="all-charts-block__inline-preview"
                    id={inlinePreviewId}
                >
                    {selectedTab && (
                        <AllChartsPreview slug={row.slug} tab={selectedTab} />
                    )}
                </div>
            )}
        </li>
    )
}

function AllChartsSearchInput({
    search,
}: {
    search: AllChartsBlockSearch
}): React.ReactElement {
    const inputRef = useRef<HTMLInputElement>(null)
    return (
        <div className="all-charts-block__search" role="search">
            <FontAwesomeIcon
                className="all-charts-block__search-icon"
                icon={faMagnifyingGlass}
            />
            <input
                ref={inputRef}
                type="text"
                className="all-charts-block__search-input"
                aria-label="Search charts on this topic"
                placeholder={search.placeholder}
                value={search.query}
                onChange={(event) => search.onQueryChange(event.target.value)}
            />
            {search.query !== "" && (
                <button
                    type="button"
                    className="all-charts-block__search-clear"
                    aria-label="Clear search"
                    onClick={() => {
                        search.onQueryChange("")
                        inputRef.current?.focus()
                    }}
                >
                    <FontAwesomeIcon icon={faCircleXmark} />
                </button>
            )}
        </div>
    )
}

export function AllChartsBlockSkeleton({
    id,
    heading,
    className,
    ref,
}: {
    id: string
    heading: string
    className?: string
    ref?: React.Ref<HTMLElement>
}): React.ReactElement {
    return (
        <section
            className={cx(className, "needs-dividers", "all-charts-block")}
            ref={ref}
        >
            <AllChartsHeading id={id} heading={heading} />
            <div className="all-charts-block__skeleton-search animate-pulse" />
            <div className="grid grid-cols-12">
                <div className="all-charts-block__list-wrapper span-cols-5 span-md-cols-12">
                    <ul className="all-charts-block__list animate-pulse">
                        {Array.from(
                            { length: SKELETON_ROW_COUNT },
                            (_, index) => (
                                <li
                                    className="all-charts-block__item all-charts-block__skeleton-row"
                                    key={index}
                                >
                                    <div className="all-charts-block__skeleton-title" />
                                    <div className="all-charts-block__skeleton-source" />
                                    <div className="all-charts-block__skeleton-thumbnail" />
                                    {index === 0 && (
                                        <div className="all-charts-block__skeleton-inline-preview" />
                                    )}
                                </li>
                            )
                        )}
                    </ul>
                </div>
                <div className="all-charts-block__preview all-charts-block__skeleton-preview animate-pulse span-cols-7 span-md-cols-12" />
            </div>
        </section>
    )
}

export function AllChartsBlockError({
    id,
    heading,
    searchHref,
    className,
}: {
    id: string
    heading: string
    searchHref: string
    className?: string
}): React.ReactElement {
    return (
        <section
            className={cx(className, "needs-dividers", "all-charts-block")}
        >
            <AllChartsHeading id={id} heading={heading} />
            <AllChartsPanel
                icon={faExclamationTriangle}
                heading="We couldn't load the charts on this topic."
                text="Try reloading the page, or search all our charts."
                href={searchHref}
            />
        </section>
    )
}

function AllChartsNoResults({
    hasQuery,
    searchHref,
}: {
    hasQuery: boolean
    searchHref: string
}): React.ReactElement {
    return hasQuery ? (
        <AllChartsPanel
            icon={faSearch}
            heading="There are no results for this query."
            text="Try searching for something else or searching all our charts."
            href={searchHref}
        />
    ) : (
        <AllChartsPanel
            icon={faSearch}
            heading="There are no charts on this topic yet."
            text="Search all our charts instead."
            href={searchHref}
        />
    )
}

function AllChartsPanel({
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
        <div className="all-charts-block__panel">
            <SearchNoResults
                heading={heading}
                subtitle={
                    <>
                        <p className="body-3-medium">{text}</p>
                        <Button
                            className="all-charts-block__search-button"
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

function AllChartsPreview({
    slug,
    tab,
}: {
    slug: string
    tab: GrapherTabName
}): React.ReactElement {
    const { isPreviewing } = useDocumentContext()
    return (
        <GrapherWithFallback
            key={`${slug}:${tab}`}
            slug={slug}
            queryStr={queryParamsToStr(toGrapherQueryParams({ tab }))}
            className={GRAPHER_PREVIEW_CLASS}
            isEmbeddedInAnOwidPage
            isEmbeddedInADataPage={false}
            config={PREVIEW_GRAPHER_CONFIG}
            isPreviewing={isPreviewing}
        />
    )
}

function AllChartsHeading({
    id,
    heading,
    rowCount,
}: AllChartsHeadingProps): React.ReactElement {
    return (
        <h1 className="article-block__heading h1-semibold" id={id}>
            <span>{heading}</span>
            {rowCount !== undefined && (
                <span className="all-charts-block__count">
                    {`(${rowCount} ${rowCount === 1 ? "chart" : "charts"})`}
                </span>
            )}
            <a className="deep-link" aria-labelledby={id} href={`#${id}`} />
        </h1>
    )
}

function getDefaultTabForRow(
    row: AllChartsRowData,
    countries: string[]
): GrapherTabName {
    const [firstTab] = pickThumbnailTabs(row.availableTabs, {
        hasCountries: countries.length > 0,
    })
    return firstTab ?? GRAPHER_TAB_NAMES.Table
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
