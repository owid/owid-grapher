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
    SearchChartViewHit,
} from "@ourworldindata/types"
import { commafyNumber, queryParamsToStr } from "@ourworldindata/utils"
import { GrapherWithFallback } from "../GrapherWithFallback.js"
import { useDocumentContext } from "../gdocs/DocumentContext.js"
import { MEDIUM_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import { toGrapherQueryParams } from "../search/searchUtils.js"
import { SearchHorizontalDivider } from "../search/SearchHorizontalDivider.js"
import { SearchNoResults } from "../search/SearchNoResults.js"
import { AllChartsRow } from "./AllChartsRow.js"

const SKELETON_ROW_COUNT = 6
const MAX_THUMBNAILS = 3
const PREVIEW_GRAPHER_CONFIG = { enableKeyboardShortcuts: false }
const SEARCH_PLACEHOLDER =
    "Search indicators by name, keyword, country, or source…"

export interface AllChartsBlockSearch {
    query: string
    fetchedQuery: string
    onQueryChange: (query: string) => void
    suggestedTerms: string[]
    isLoadingSuggestions: boolean
    onSuggestionSelect: (term: string) => void
}

interface AllChartsSelection {
    slug: string
    tab?: GrapherTabName
}

interface AllChartsHeadingProps {
    id: string
    heading: string
    hitCount?: number
}

export function AllChartsBlock({
    id,
    heading,
    hitCount,
    hits,
    countries,
    search,
    onLoadMore,
    isLoadingMore,
    searchStatus,
    noResultsHref,
    className,
}: {
    id: string
    heading: string
    hitCount?: number
    hits: SearchChartViewHit[]
    countries: string[]
    search?: AllChartsBlockSearch
    onLoadMore?: () => void
    isLoadingMore?: boolean
    searchStatus?: "pending" | "error"
    noResultsHref: string
    className?: string
}): React.ReactElement {
    const fetchedQuery = search?.fetchedQuery ?? ""
    return (
        <section
            className={cx(className, "needs-dividers", "all-charts-block")}
        >
            <AllChartsHeading id={id} heading={heading} hitCount={hitCount} />
            {search && <AllChartsSearchInput search={search} />}
            {searchStatus === "pending" ? (
                <AllChartsResultsSkeleton />
            ) : searchStatus === "error" ? (
                <AllChartsErrorPanel searchHref={noResultsHref} />
            ) : hits.length === 0 ? (
                <AllChartsNoResults
                    hasQuery={fetchedQuery !== ""}
                    searchHref={noResultsHref}
                />
            ) : (
                <AllChartsResults
                    key={fetchedQuery}
                    hits={hits}
                    countries={countries}
                    onLoadMore={onLoadMore}
                    isLoadingMore={isLoadingMore}
                />
            )}
        </section>
    )
}

function AllChartsResults({
    hits,
    countries,
    onLoadMore,
    isLoadingMore,
}: {
    hits: SearchChartViewHit[]
    countries: string[]
    onLoadMore?: () => void
    isLoadingMore?: boolean
}): React.ReactElement {
    const [selection, setSelection] = useState<AllChartsSelection>()

    const selectedHit =
        hits.find((hit) => hit.slug === selection?.slug) ?? hits[0]
    const selectedTab =
        (selection?.slug === selectedHit.slug && selection.tab) ||
        getDefaultTab(pickThumbnailTabs(selectedHit.availableTabs), countries)

    const isNarrow = useMediaQuery(MEDIUM_BREAKPOINT_MEDIA_QUERY)

    return (
        <div className="grid grid-cols-12">
            <AllChartsList
                hits={hits}
                countries={countries}
                selectedHit={selectedHit}
                selectedTab={selectedTab}
                isNarrow={isNarrow}
                onSelect={(hit, tab) => setSelection({ slug: hit.slug, tab })}
                onLoadMore={onLoadMore}
                isLoadingMore={isLoadingMore}
            />
            {!isNarrow && (
                <div className="all-charts-block__preview span-cols-7">
                    <AllChartsPreview
                        slug={selectedHit.slug}
                        tab={selectedTab}
                        countries={countries}
                    />
                </div>
            )}
        </div>
    )
}

function AllChartsList({
    hits,
    countries,
    selectedHit,
    selectedTab,
    isNarrow,
    onSelect,
    onLoadMore,
    isLoadingMore,
}: {
    hits: SearchChartViewHit[]
    countries: string[]
    selectedHit: SearchChartViewHit
    selectedTab: GrapherTabName
    isNarrow: boolean
    onSelect: (hit: SearchChartViewHit, tab: GrapherTabName | undefined) => void
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
                {hits.map((hit) => (
                    <AllChartsItem
                        key={hit.objectID}
                        hit={hit}
                        countries={countries}
                        isSelected={hit === selectedHit}
                        selectedTab={selectedTab}
                        isNarrow={isNarrow}
                        onSelect={(tab) => onSelect(hit, tab)}
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
    hit,
    countries,
    isSelected,
    selectedTab,
    isNarrow,
    onSelect,
}: {
    hit: SearchChartViewHit
    countries: string[]
    isSelected: boolean
    selectedTab: GrapherTabName
    isNarrow: boolean
    onSelect: (tab: GrapherTabName | undefined) => void
}): React.ReactElement {
    const itemRef = useRef<HTMLLIElement>(null)
    const inlinePreviewId = useId()
    const thumbnailTabs = pickThumbnailTabs(hit.availableTabs)

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
                hit={hit}
                isSelected={isSelected}
                displayedTab={
                    isSelected
                        ? selectedTab
                        : getDefaultTab(thumbnailTabs, countries)
                }
                thumbnailTabs={thumbnailTabs}
                countries={countries}
                inlinePreviewId={isNarrow ? inlinePreviewId : undefined}
                onTitleSelect={() => {
                    if (!isSelected) select(undefined, true)
                }}
                onThumbnailSelect={(tab) => select(tab, true)}
            />
            {isNarrow && isSelected && (
                <div
                    className="all-charts-block__inline-preview"
                    id={inlinePreviewId}
                >
                    <AllChartsPreview
                        slug={hit.slug}
                        tab={selectedTab}
                        countries={countries}
                    />
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
    const {
        query,
        onQueryChange,
        suggestedTerms,
        isLoadingSuggestions,
        onSuggestionSelect,
    } = search
    const inputRef = useRef<HTMLInputElement>(null)
    return (
        <>
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
                    placeholder={SEARCH_PLACEHOLDER}
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                />
                {query !== "" && (
                    <button
                        type="button"
                        className="all-charts-block__search-clear"
                        aria-label="Clear search"
                        onClick={() => {
                            onQueryChange("")
                            inputRef.current?.focus()
                        }}
                    >
                        <FontAwesomeIcon icon={faCircleXmark} />
                    </button>
                )}
            </div>
            <AllChartsSuggestions
                terms={suggestedTerms}
                isLoading={isLoadingSuggestions}
                onSelect={(term) => {
                    onSuggestionSelect(term)
                    inputRef.current?.focus()
                }}
            />
        </>
    )
}

function AllChartsSuggestions({
    terms,
    isLoading,
    onSelect,
}: {
    terms: string[]
    isLoading: boolean
    onSelect: (term: string) => void
}): React.ReactElement | null {
    if (isLoading)
        return <div className="all-charts-block__suggestions" aria-hidden />
    if (terms.length === 0) return null
    return (
        <div className="all-charts-block__suggestions">
            <span className="all-charts-block__suggestions-label">
                Suggested:
            </span>
            <ul className="all-charts-block__suggestions-list">
                {terms.map((term) => (
                    <li key={term} className="all-charts-block__suggestion">
                        <button
                            type="button"
                            className="all-charts-block__suggestion-button"
                            onClick={() => onSelect(term)}
                        >
                            {term}
                        </button>
                    </li>
                ))}
            </ul>
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
            <div className="all-charts-block__suggestions" aria-hidden />
            <AllChartsResultsSkeleton />
        </section>
    )
}

function AllChartsResultsSkeleton(): React.ReactElement {
    return (
        <div className="grid grid-cols-12">
            <div className="all-charts-block__list-wrapper span-cols-5 span-md-cols-12">
                <ul className="all-charts-block__list animate-pulse">
                    {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
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
                    ))}
                </ul>
            </div>
            <div className="all-charts-block__preview all-charts-block__skeleton-preview animate-pulse span-cols-7 span-md-cols-12" />
        </div>
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
            <AllChartsErrorPanel searchHref={searchHref} />
        </section>
    )
}

function AllChartsErrorPanel({
    searchHref,
}: {
    searchHref: string
}): React.ReactElement {
    return (
        <AllChartsPanel
            icon={faExclamationTriangle}
            heading="We couldn't load the charts on this topic."
            text="Try reloading the page, or search all our charts."
            href={searchHref}
        />
    )
}

function AllChartsNoResults({
    hasQuery,
    searchHref,
}: {
    hasQuery: boolean
    searchHref: string
}): React.ReactElement {
    return (
        <AllChartsPanel
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
    countries,
}: {
    slug: string
    tab: GrapherTabName
    countries: string[]
}): React.ReactElement {
    const { isPreviewing } = useDocumentContext()
    return (
        <GrapherWithFallback
            key={`${slug}:${tab}:${countries.join("|")}`}
            slug={slug}
            queryStr={queryParamsToStr(
                toGrapherQueryParams({ tab, entities: countries })
            )}
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
    hitCount,
}: AllChartsHeadingProps): React.ReactElement {
    return (
        <h1 className="article-block__heading h1-semibold" id={id}>
            <span>{heading}</span>
            {hitCount !== undefined && (
                <span className="all-charts-block__count">
                    {`(${commafyNumber(hitCount)} ${hitCount === 1 ? "chart" : "charts"})`}
                </span>
            )}
            <a className="deep-link" aria-labelledby={id} href={`#${id}`} />
        </h1>
    )
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
