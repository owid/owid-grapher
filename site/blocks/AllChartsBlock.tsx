import * as React from "react"
import { useEffect, useId, useRef, useState } from "react"
import { flushSync } from "react-dom"
import cx from "clsx"
import { useIntersectionObserver, useMediaQuery } from "usehooks-ts"
import {
    faExclamationTriangle,
    faSearch,
} from "@fortawesome/free-solid-svg-icons"
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

interface AllChartsSelection {
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
    className,
}: {
    id: string
    heading: string
    rowCount: number
    rows: AllChartsRowData[]
    onLoadMore?: () => void
    isLoadingMore?: boolean
    className?: string
}): React.ReactElement {
    const [selection, setSelection] = useState<AllChartsSelection | undefined>()
    const [listElement, setListElement] = useState<HTMLUListElement | null>(
        null
    )

    const selectedRow =
        rows.find((row) => row.slug === selection?.slug) ?? rows[0]
    const selectedTab =
        selectedRow &&
        ((selection?.slug === selectedRow.slug && selection.tab) ||
            getDefaultTabForRow(selectedRow, []))

    const isNarrow = useMediaQuery(MEDIUM_BREAKPOINT_MEDIA_QUERY)

    const inlinePreviewId = useId()
    const selectedItemRef = useRef<HTMLLIElement>(null)

    const select = (
        row: AllChartsRowData,
        tab: GrapherTabName | undefined,
        shouldScrollToRow: boolean
    ): void => {
        flushSync(() => setSelection({ slug: row.slug, tab }))
        if (isNarrow && shouldScrollToRow)
            selectedItemRef.current?.scrollIntoView({ block: "start" })
    }

    const { ref: sentinelRef, isIntersecting: isSentinelVisible } =
        useIntersectionObserver({ root: listElement })

    useEffect(() => {
        if (onLoadMore && isSentinelVisible) onLoadMore()
    }, [onLoadMore, isSentinelVisible])

    return (
        <section
            className={cx(className, "needs-dividers", "all-charts-block")}
        >
            <AllChartsHeading id={id} heading={heading} rowCount={rowCount} />
            <div className="grid grid-cols-12">
                <div className="all-charts-block__list-wrapper span-cols-5 span-md-cols-12">
                    <ul className="all-charts-block__list" ref={setListElement}>
                        {rows.map((row) => {
                            const isSelected = row === selectedRow
                            return (
                                <li
                                    className={cx("all-charts-block__item", {
                                        "all-charts-block__item--selected":
                                            isSelected,
                                    })}
                                    key={`${row.type}:${row.slug}:${row.queryParams ?? ""}`}
                                    ref={
                                        isSelected ? selectedItemRef : undefined
                                    }
                                >
                                    <AllChartsRow
                                        row={row}
                                        isSelected={isSelected}
                                        selectedTab={selectedTab}
                                        thumbnailTabs={pickThumbnailTabs(
                                            row.availableTabs,
                                            { hasCountries: false }
                                        )}
                                        countries={[]}
                                        inlinePreviewId={
                                            isNarrow
                                                ? inlinePreviewId
                                                : undefined
                                        }
                                        onTitleSelect={(tab) =>
                                            select(
                                                row,
                                                tab,
                                                row !== selectedRow
                                            )
                                        }
                                        onThumbnailSelect={(tab) =>
                                            select(row, tab, true)
                                        }
                                    />
                                    {isNarrow && isSelected && (
                                        <div
                                            className="all-charts-block__inline-preview"
                                            id={inlinePreviewId}
                                        >
                                            {selectedTab && (
                                                <AllChartsPreview
                                                    slug={row.slug}
                                                    tab={selectedTab}
                                                />
                                            )}
                                        </div>
                                    )}
                                </li>
                            )
                        })}
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
        </section>
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
            <div className="all-charts-block__error">
                <SearchNoResults
                    heading="We couldn't load the charts on this topic."
                    subtitle={
                        <>
                            <p className="body-3-medium">
                                Try reloading the page, or search all our
                                charts.
                            </p>
                            <Button
                                className="all-charts-block__search-button"
                                theme="solid-vermillion"
                                text="Search all charts"
                                href={searchHref}
                                icon={faSearch}
                                iconPosition="left"
                            />
                        </>
                    }
                    icon={faExclamationTriangle}
                />
            </div>
        </section>
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
            config={{ enableKeyboardShortcuts: false }}
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
