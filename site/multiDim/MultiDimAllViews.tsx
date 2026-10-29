import { Fragment, useMemo, useRef, useState } from "react"
import * as React from "react"
import cx from "clsx"
import {
    faMagnifyingGlass,
    faMinus,
    faPlus,
    faXmark,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { TextInput } from "@ourworldindata/components"
import {
    HIDE_IF_JS_DISABLED_CLASSNAME,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import { SiteAnalytics } from "../SiteAnalytics.js"
import {
    MultiDimViewCommandBar,
    useCommandBarShortcutLabel,
} from "./MultiDimViewCommandBar.js"
import { highlightTokens, useViewSearch } from "./useViewSearch.js"

const analytics = new SiteAnalytics()

// Above this many views, the list starts collapsed and gets a search box
const COLLAPSED_THRESHOLD = 12
// Above this many views, groups start collapsed (except the current one)
const GROUPS_COLLAPSED_THRESHOLD = 48

export interface MultiDimAllViewsView {
    /** Canonical sorted query string, e.g. "antigen=dtpcv1&metric=vaccinated" */
    queryStr: string
    title: string
    /** In config dimension order; choices[0] is the grouping dimension */
    choices: { dimensionName: string; choiceName: string }[]
}

interface ViewGroup {
    dimensionName: string
    choiceName: string
    views: MultiDimAllViewsView[]
}

export function MultiDimAllViews({
    slug,
    pageTitle,
    currentQueryStr,
    views,
    onSelectView,
}: {
    slug: string
    pageTitle: string
    currentQueryStr: string
    views: MultiDimAllViewsView[]
    onSelectView?: (dimensions: MultiDimDimensionChoices) => void
}) {
    const [query, setQuery] = useState("")
    const [isCommandBarOpen, setIsCommandBarOpen] = useState(false)
    const shortcutLabel = useCommandBarShortcutLabel()
    const inputRef = useRef<HTMLInputElement>(null)

    const total = views.length
    const isCollapsible = total > COLLAPSED_THRESHOLD
    const dimensionNames = views[0]?.choices.map((c) => c.dimensionName) ?? []
    const isGrouped = dimensionNames.length >= 2

    const { tokens, isSearching, matches } = useViewSearch(views, query)
    const visibleCount = isSearching ? views.filter(matches).length : total
    const showEmptyState = isSearching && visibleCount === 0

    const groups = useMemo((): ViewGroup[] => {
        if (!isGrouped) return []
        const byChoice = new Map<string, ViewGroup>()
        for (const view of views) {
            const { dimensionName, choiceName } = view.choices[0]
            let group = byChoice.get(choiceName)
            if (!group) {
                group = { dimensionName, choiceName, views: [] }
                byChoice.set(choiceName, group)
            }
            group.views.push(view)
        }
        return [...byChoice.values()]
    }, [views, isGrouped])

    const placeholderDims = dimensionNames
        .slice(0, 2)
        .map((name) => name.toLowerCase())
    const placeholder =
        placeholderDims.length === 2
            ? `Search by title, ${placeholderDims[0]} or ${placeholderDims[1]}…`
            : `Search by title or ${placeholderDims[0] ?? "option"}…`

    const clearSearch = (): void => {
        setQuery("")
        inputRef.current?.focus()
    }

    // Switches the chart above to `view` and scrolls up to it
    const selectView = (
        selectViewDimensions: (dimensions: MultiDimDimensionChoices) => void,
        view: MultiDimAllViewsView
    ): void => {
        selectViewDimensions(
            Object.fromEntries(new URLSearchParams(view.queryStr))
        )
        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches
        document.getElementById("explore-the-data")?.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "start",
        })
    }

    const handleViewClick = (
        e: React.MouseEvent<HTMLAnchorElement>,
        view: MultiDimAllViewsView
    ): void => {
        if (!onSelectView) return
        if (
            e.button !== 0 ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey ||
            e.defaultPrevented
        )
            return
        e.preventDefault()
        selectView(onSelectView, view)
    }

    const renderList = (listViews: MultiDimAllViewsView[]) => (
        <ul className="all-views__list">
            {listViews.map((view) => {
                const isCurrent = view.queryStr === currentQueryStr
                const metaChoices = isGrouped
                    ? view.choices.slice(1)
                    : view.choices
                return (
                    <li
                        key={view.queryStr}
                        className={cx("all-views__item", {
                            "all-views__item--current": isCurrent,
                        })}
                        hidden={isSearching && !matches(view)}
                    >
                        <a
                            className="all-views__link"
                            href={`/grapher/${slug}?${view.queryStr}`}
                            aria-current={isCurrent ? "page" : undefined}
                            data-track-note="mdim_all_views_link"
                            onClick={(e) => handleViewClick(e, view)}
                        >
                            {highlightTokens(view.title, tokens)}
                        </a>
                        {isCurrent && (
                            <span className="all-views__current-label">
                                Currently shown
                            </span>
                        )}
                        {metaChoices.length > 0 && (
                            <span className="all-views__meta">
                                {metaChoices.map((c, i) => (
                                    <Fragment key={c.dimensionName}>
                                        {i > 0 && (
                                            <span
                                                className="all-views__meta-sep"
                                                aria-hidden="true"
                                            >
                                                ·
                                            </span>
                                        )}
                                        {highlightTokens(
                                            c.dimensionName,
                                            tokens
                                        )}
                                        :{" "}
                                        {highlightTokens(c.choiceName, tokens)}
                                    </Fragment>
                                ))}
                            </span>
                        )}
                    </li>
                )
            })}
        </ul>
    )

    return (
        <div className="section-wrapper grid">
            <div className="span-cols-3 span-lg-cols-12">
                <h2 className="all-views__title" id="all-charts">
                    All charts on this page
                </h2>
                <p className="all-views__description">
                    This page combines {total} charts on{" "}
                    {pageTitle.charAt(0).toLowerCase() + pageTitle.slice(1)}.
                    Use the menus above the chart to switch between them, or
                    browse the full list here.
                </p>
            </div>

            <details
                className="all-views span-cols-9 span-lg-cols-12"
                open={!isCollapsible}
                onToggle={(e) => {
                    if (e.target === e.currentTarget)
                        analytics.logExpandableToggle(
                            "mdim_all_views",
                            e.currentTarget.open
                        )
                }}
            >
                <summary className="all-views__summary">
                    <span className="all-views__summary-label all-views__summary-label--expand">
                        Show all {total} charts
                    </span>
                    <span className="all-views__summary-label all-views__summary-label--collapse">
                        Hide the list
                    </span>
                    <FontAwesomeIcon
                        className="all-views__icon all-views__icon--expand"
                        icon={faPlus}
                    />
                    <FontAwesomeIcon
                        className="all-views__icon all-views__icon--collapse"
                        icon={faMinus}
                    />
                </summary>

                <div className="all-views__content">
                    {isCollapsible && (
                        <div
                            className={`all-views__search ${HIDE_IF_JS_DISABLED_CLASSNAME}`}
                        >
                            <label
                                htmlFor="all-views-search"
                                className="sr-only"
                            >
                                Search the charts on this page
                            </label>
                            <FontAwesomeIcon
                                className="all-views__search-icon"
                                icon={faMagnifyingGlass}
                            />
                            <TextInput
                                ref={inputRef}
                                id="all-views-search"
                                className="all-views__search-input"
                                type="search"
                                autoComplete="off"
                                placeholder={placeholder}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") setQuery("")
                                }}
                                aria-describedby="all-views-status"
                            />
                            {query && (
                                <button
                                    type="button"
                                    className="all-views__clear"
                                    aria-label="Clear search"
                                    onClick={clearSearch}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            )}
                            {/* Takes the clear button's place */}
                            {!query && onSelectView && shortcutLabel && (
                                <button
                                    type="button"
                                    className="all-views__command-bar-button"
                                    onClick={() => setIsCommandBarOpen(true)}
                                >
                                    <span className="sr-only">
                                        Open the chart switcher
                                    </span>
                                    <kbd aria-hidden="true">
                                        {shortcutLabel}
                                    </kbd>
                                </button>
                            )}
                            <p
                                id="all-views-status"
                                className="all-views__status"
                                role="status"
                                aria-live="polite"
                            >
                                {isSearching &&
                                    visibleCount > 0 &&
                                    `${visibleCount} of ${total} charts match`}
                                {showEmptyState && (
                                    <>No charts match “{query.trim()}”.</>
                                )}
                            </p>
                        </div>
                    )}

                    {showEmptyState && (
                        <div className="all-views__empty">
                            <p className="all-views__empty-text">
                                Try a shorter word, or search for one of the
                                options shown in the menus above the chart.
                            </p>
                            <button
                                type="button"
                                className="all-views__empty-clear"
                                onClick={clearSearch}
                            >
                                Clear search
                            </button>
                        </div>
                    )}

                    {!isGrouped && renderList(views)}

                    {groups.map((group) => {
                        const groupVisible = isSearching
                            ? group.views.filter(matches).length
                            : group.views.length
                        const containsCurrent = group.views.some(
                            (v) => v.queryStr === currentQueryStr
                        )
                        const open = isSearching
                            ? groupVisible > 0
                            : total <= GROUPS_COLLAPSED_THRESHOLD ||
                              containsCurrent
                        return (
                            <details
                                key={group.choiceName}
                                className="all-views__group"
                                open={open}
                                hidden={isSearching && groupVisible === 0}
                            >
                                <summary className="all-views__group-summary">
                                    <h3 className="all-views__group-title">
                                        <span className="all-views__group-dimension">
                                            {highlightTokens(
                                                group.dimensionName,
                                                tokens
                                            )}
                                            :
                                        </span>{" "}
                                        {highlightTokens(
                                            group.choiceName,
                                            tokens
                                        )}
                                    </h3>
                                    <span className="all-views__group-count">
                                        {isSearching
                                            ? `${groupVisible} of ${group.views.length}`
                                            : group.views.length}
                                    </span>
                                    <FontAwesomeIcon
                                        className="all-views__icon all-views__icon--expand"
                                        icon={faPlus}
                                    />
                                    <FontAwesomeIcon
                                        className="all-views__icon all-views__icon--collapse"
                                        icon={faMinus}
                                    />
                                </summary>
                                {renderList(group.views)}
                            </details>
                        )
                    })}
                </div>
            </details>

            {onSelectView && (
                <MultiDimViewCommandBar
                    currentQueryStr={currentQueryStr}
                    views={views}
                    isOpen={isCommandBarOpen}
                    onOpenChange={setIsCommandBarOpen}
                    onSelectView={(view) => selectView(onSelectView, view)}
                />
            )}
        </div>
    )
}
