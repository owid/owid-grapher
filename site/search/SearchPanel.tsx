import ReactDOM from "react-dom"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import cx from "classnames"
import {
    keyBy,
    getWindowQueryParams,
    get,
    mapValues,
    isElementHidden,
    sortBy,
    groupBy,
    uniqBy,
    EntityName,
    Url,
    Region,
} from "@ourworldindata/utils"
import {
    InstantSearch,
    Configure,
    SearchBox,
    Hits,
    Highlight,
    Index,
    Snippet,
    useInstantSearch,
    PoweredBy,
    useHits,
} from "react-instantsearch"
import algoliasearch, { SearchClient } from "algoliasearch"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
    BAKED_BASE_URL,
    BAKED_GRAPHER_EXPORTS_BASE_URL,
    BAKED_GRAPHER_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../../settings/clientSettings.js"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import {
    IChartHit,
    SearchCategoryFilter,
    SearchIndexName,
    searchCategoryFilters,
    IPageHit,
    pageTypeDisplayNames,
    IExplorerViewHit,
    PageRecord,
} from "./searchTypes.js"
import { EXPLORERS_ROUTE_FOLDER } from "../../explorer/ExplorerConstants.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faArrowRight,
    faHeartBroken,
    faSearch,
} from "@fortawesome/free-solid-svg-icons"
import {
    DEFAULT_SEARCH_PLACEHOLDER,
    getIndexName,
    logSiteSearchClickToAlgoliaInsights,
} from "./searchClient.js"
import {
    PreferenceType,
    getPreferenceValue,
} from "../CookiePreferencesManager.js"
import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
    setSelectedEntityNamesParam,
} from "@ourworldindata/grapher"
import type { SearchResults as AlgoliaSearchResultsType } from "algoliasearch-helper"
import { SiteAnalytics } from "../SiteAnalytics.js"
import {
    extractRegionNamesFromSearchQuery,
    pickEntitiesForChartHit,
} from "./SearchUtils.js"

const siteAnalytics = new SiteAnalytics()

function PagesHit({ hit }: { hit: IPageHit }) {
    return (
        <a
            href={`${BAKED_BASE_URL}/${hit.slug}`}
            data-algolia-index={getIndexName(SearchIndexName.Pages)}
            data-algolia-object-id={hit.objectID}
            data-algolia-position={hit.__position}
        >
            {/* TODO: index featured images */}
            <header className="page-hit__header">
                <h4 className="h3-bold search-results__page-hit-title">
                    {hit.title}
                </h4>
                <span className="body-3-medium search-results__page-hit-type">
                    {pageTypeDisplayNames[hit.type]}
                </span>
            </header>
            <Snippet
                className="body-3-medium search-results__page-hit-snippet"
                attribute="excerpt"
                highlightedTagName="strong"
                hit={hit}
            />
        </a>
    )
}

const getEntityQueryStr = (
    entities: EntityName[] | null | undefined,
    existingQueryStr: string = ""
) => {
    if (!entities?.length) return existingQueryStr
    else {
        return setSelectedEntityNamesParam(
            // If we have any entities pre-selected, we want to show the chart tab
            Url.fromQueryStr(existingQueryStr).updateQueryParams({
                tab: "chart",
            }),
            entities
        ).queryStr
    }
}

function ChartHit({ hit }: { hit: IChartHit }) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const [imgError, setImgError] = useState(false)

    const entities = useMemo(
        () => pickEntitiesForChartHit(hit),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [hit._highlightResult?.availableEntities]
    )
    const queryStr = useMemo(() => getEntityQueryStr(entities), [entities])
    const previewUrl = queryStr
        ? `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${hit.slug}${queryStr}`
        : `${BAKED_GRAPHER_EXPORTS_BASE_URL}/${hit.slug}.svg`

    useEffect(() => {
        setImgLoaded(false)
        setImgError(false)
    }, [previewUrl])

    return (
        <a
            href={`${BAKED_GRAPHER_URL}/${hit.slug}${queryStr}`}
            data-algolia-index={getIndexName(SearchIndexName.Charts)}
            data-algolia-object-id={hit.objectID}
            data-algolia-position={hit.__position}
        >
            <div className="search-results__chart-hit-img-container">
                {imgError && (
                    <div className="search-results__chart-hit-img-error">
                        <FontAwesomeIcon icon={faHeartBroken} />
                        <span>Chart preview not available</span>
                    </div>
                )}
                <img
                    key={previewUrl}
                    className={cx({ loaded: imgLoaded, error: imgError })}
                    loading="lazy"
                    width={DEFAULT_GRAPHER_WIDTH}
                    height={DEFAULT_GRAPHER_HEIGHT}
                    src={previewUrl}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                />
            </div>
            <div className="search-results__chart-hit-title-container">
                <Highlight
                    attribute="title"
                    highlightedTagName="strong"
                    className="search-results__chart-hit-highlight"
                    hit={hit}
                />{" "}
                <span className="search-results__chart-hit-variant">
                    {hit.variantName}
                </span>
            </div>
            {entities.length > 0 && (
                <ul className="search-results__chart-hit-entities">
                    {entities.map((entity) => (
                        <li key={entity}>{entity}</li>
                    ))}
                </ul>
            )}
        </a>
    )
}

interface ExplorerViewHitWithPosition extends IExplorerViewHit {
    // Analytics data
    // Position of this hit in the search results: For example, if there is one card with 3 views, and a second card with 2 views, the first card will have hitPosition 0, 1, and 2, and the second card will have hitPosition 3 and 4.
    hitPositionOverall: number
    // Position of this hit within the card: For example, if there are 3 views in a card, they will have positions 0, 1, and 2.
    hitPositionWithinCard: number
}

interface GroupedExplorerViews {
    explorerSlug: string
    explorerTitle: string
    explorerSubtitle: string
    numViewsWithinExplorer: number
    views: ExplorerViewHitWithPosition[]
}

const getNumberOfExplorerHits = (rawHits: IExplorerViewHit[]) =>
    uniqBy(rawHits, "explorerSlug").length

function ExplorerViewHits({
    countriesRegionsToSelect,
}: {
    countriesRegionsToSelect?: Region[]
}) {
    const { hits } = useHits<IExplorerViewHit>()

    const groupedHits = useMemo(() => {
        const groupedBySlug = groupBy(hits, "explorerSlug")
        const arr = Object.values(groupedBySlug).map((explorerViews) => {
            const firstView = explorerViews[0]
            return {
                explorerSlug: firstView.explorerSlug,
                explorerTitle: firstView.explorerTitle,
                explorerSubtitle: firstView.explorerSubtitle,
                numViewsWithinExplorer: firstView.numViewsWithinExplorer,

                // Run uniq, so if we end up in a situation where multiple views with the same title
                // are returned, we only show the first of them
                views: uniqBy(explorerViews, "viewTitle"),
            }
        })
        let totalHits = 0
        arr.forEach((group) => {
            group.views = group.views.map((view, index) => ({
                ...view,
                hitPositionWithinCard: index,
                hitPositionOverall: totalHits + index,
            })) as ExplorerViewHitWithPosition[]
            totalHits += group.views.length
        })
        return arr as GroupedExplorerViews[]
    }, [hits])

    return (
        <div className="search-results__list-container">
            <div className="search-results__explorer-list grid grid-cols-1">
                {groupedHits.map((group, i) => (
                    <ExplorerHit
                        groupedHit={group}
                        key={group.explorerSlug}
                        cardPosition={i}
                        countriesRegionsToSelect={countriesRegionsToSelect}
                    />
                ))}
            </div>
        </div>
    )
}

function ExplorerHit({
    groupedHit,
    cardPosition,
    countriesRegionsToSelect,
}: {
    groupedHit: GroupedExplorerViews
    cardPosition: number
    countriesRegionsToSelect?: Region[]
}) {
    const firstHit = groupedHit.views[0]

    // If the explorer title contains something like "Ukraine" already, don't bother selecting Ukraine in it
    const entitiesToSelectExcludingExplorerTitle =
        countriesRegionsToSelect?.filter(
            (e) => !groupedHit.explorerTitle.includes(e.name)
        )
    const queryStr = getEntityQueryStr(
        entitiesToSelectExcludingExplorerTitle?.map((e) => e.name)
    )

    const exploreAllProps = {
        href: `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${groupedHit.explorerSlug}${queryStr}`,
        "data-algolia-index": getIndexName(SearchIndexName.ExplorerViews),
        "data-algolia-object-id": firstHit.objectID,
        "data-algolia-position": firstHit.hitPositionOverall + 1,
        "data-algolia-card-position": cardPosition + 1,
        "data-algolia-position-within-card": 0,
        "data-algolia-event-name": "click_explorer",
    }

    return (
        <div
            key={groupedHit.explorerSlug}
            className="search-results__explorer-hit"
        >
            <div className="search-results__explorer-hit-header">
                <div className="search-results__explorer-hit-title-container">
                    <h3 className="h3-bold search-results__explorer-hit-title">
                        {groupedHit.explorerTitle} Data Explorer
                    </h3>
                    <p className="body-3-medium-italic search-results__explorer-hit-subtitle">
                        {groupedHit.explorerSubtitle}
                    </p>
                </div>

                <div className="search-results__explorer-hit-link hide-sm-only">
                    <a {...exploreAllProps}>
                        Explore all {groupedHit.numViewsWithinExplorer}{" "}
                        indicators
                    </a>
                </div>
            </div>
            <ul className="search-results__explorer-views-list grid grid-cols-2 grid-sm-cols-1">
                {groupedHit.views.map((view) => {
                    const entitiesToSelectExcludingViewTitle =
                        entitiesToSelectExcludingExplorerTitle?.filter(
                            (e) =>
                                !view.viewTitle.includes(e.name) &&
                                !view.explorerTitle.includes(e.name)
                        )
                    const queryStr = getEntityQueryStr(
                        entitiesToSelectExcludingViewTitle?.map((e) => e.name),
                        view.viewQueryParams
                    )
                    return (
                        <li
                            key={view.objectID}
                            className="ais-Hits-item search-results__explorer-view"
                        >
                            <a
                                data-algolia-index={getIndexName(
                                    SearchIndexName.ExplorerViews
                                )}
                                data-algolia-object-id={view.objectID}
                                data-algolia-position={
                                    view.hitPositionOverall + 1
                                }
                                data-algolia-card-position={cardPosition + 1}
                                data-algolia-position-within-card={
                                    view.hitPositionWithinCard + 1
                                }
                                data-algolia-event-name="click_explorer_view"
                                href={`${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${view.explorerSlug}${queryStr}`}
                                className="search-results__explorer-view-title-container"
                            >
                                <Highlight
                                    attribute="viewTitle"
                                    hit={view}
                                    highlightedTagName="strong"
                                    className="search-results__explorer-view-title"
                                />
                                <span className="nowrap icon-container">
                                    &zwj;
                                    {/* Zero-width joiner to prevent line break between title and icon */}
                                    <FontAwesomeIcon icon={faArrowRight} />
                                </span>
                            </a>
                            <p className="body-3-medium-italic search-results__explorer-view-subtitle">
                                {view.viewSubtitle}
                            </p>
                        </li>
                    )
                })}
            </ul>
            <a
                className="search-results__explorer-hit-link-mobile hide-sm-up"
                {...exploreAllProps}
            >
                Explore all {groupedHit.numViewsWithinExplorer} indicators
            </a>
        </div>
    )
}

function ShowMore({
    category,
    cutoffNumber,
    activeCategoryFilter,
    handleCategoryFilterClick,
    getTotalNumberOfHits,
}: {
    category: SearchIndexName
    cutoffNumber: number
    activeCategoryFilter: SearchCategoryFilter
    handleCategoryFilterClick: (x: SearchIndexName) => void
    getTotalNumberOfHits?: (results: AlgoliaSearchResultsType) => number
}) {
    const { results } = useInstantSearch()
    // Hide if we're on the same tab as the category this button is for
    if (activeCategoryFilter === category) return null
    if (results.hits.length === 0) return null

    const handleClick = () => {
        window.scrollTo({ top: 0 })
        handleCategoryFilterClick(category)
    }

    const totalNumberOfHits =
        getTotalNumberOfHits?.(results) ?? results.hits.length

    const numberShowing = Math.min(cutoffNumber, totalNumberOfHits)
    const isShowingAllResults = numberShowing === totalNumberOfHits
    const message = isShowingAllResults
        ? numberShowing <= 2
            ? "Showing all results"
            : `Showing all ${numberShowing} results`
        : `Showing ${numberShowing} of the top ${totalNumberOfHits} results`

    return (
        <div
            className={cx("search-results__show-more-container", {
                "show-more-btn-hidden": isShowingAllResults,
            })}
        >
            <em>{message}</em>
            <button aria-label="Show more results" onClick={handleClick}>
                Show more
            </button>
        </div>
    )
}

function Filters({
    isHidden,
    categoryFilterContainerRef,
    handleCategoryFilterClick,
    activeCategoryFilter,
}: {
    isHidden: boolean
    categoryFilterContainerRef: React.Ref<HTMLUListElement>
    activeCategoryFilter: SearchCategoryFilter
    handleCategoryFilterClick: (x: SearchCategoryFilter) => void
}) {
    const { scopedResults } = useInstantSearch()
    if (isHidden) return null

    const resultsByIndexName = keyBy(scopedResults, "indexId")
    const hitsLengthByIndexName = mapValues(resultsByIndexName, (results) =>
        get(results, ["results", "hits", "length"], 0)
    )

    hitsLengthByIndexName[getIndexName(SearchIndexName.ExplorerViews)] =
        getNumberOfExplorerHits(
            resultsByIndexName[getIndexName(SearchIndexName.ExplorerViews)]
                ?.results?.hits ?? []
        )

    hitsLengthByIndexName[getIndexName("all")] = Object.values(
        hitsLengthByIndexName
    ).reduce((a: number, b: number) => a + b, 0)

    return (
        <div className="search-filters">
            <ul
                ref={categoryFilterContainerRef}
                className="search-filters__list"
            >
                {searchCategoryFilters.map(([label, key]) => {
                    const indexName = getIndexName(key)
                    return (
                        <li
                            key={key}
                            data-filter-key={key}
                            className="search-filters__tab"
                        >
                            <button
                                aria-label={`Toggle filter results by ${label}`}
                                disabled={
                                    hitsLengthByIndexName[indexName] === 0
                                }
                                onClick={() => handleCategoryFilterClick(key)}
                                className={cx("search-filters__tab-button", {
                                    "search-filters__tab-button--is-active":
                                        activeCategoryFilter === key,
                                })}
                            >
                                {label}
                                <span className="search-filters__tab-count">
                                    {hitsLengthByIndexName[indexName]}
                                </span>
                            </button>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

function NoResultsBoundary({ children }: { children: React.ReactElement }) {
    const { results } = useInstantSearch()

    // The `__isArtificial` flag makes sure not to display the No Results message when no hits have been returned.
    // Add the `hidden` attribute to the child <section> tag,
    // which we can leverage along with the adjacent sibling selector
    // to show a No Results screen with CSS alone
    if (!results.__isArtificial && results.nbHits === 0) {
        return React.cloneElement(children, { hidden: true })
    }

    return children
}

interface SearchResultsProps {
    activeCategoryFilter: SearchCategoryFilter
    isHidden: boolean
    handleCategoryFilterClick: (x: SearchCategoryFilter) => void
    query: string
}

const PAGES_ATTRIBUTES_TO_SEARCH_NO_FULLTEXT: (keyof PageRecord)[] = [
    "title",
    "excerpt",
    "tags",
    "authors",
] // Should be a subset of the `searchableAttributes` set up in `configureAlgolia` for the `pages` index; minus the "content" attribute

const SearchResults = (props: SearchResultsProps) => {
    const { scopedResults } = useInstantSearch()
    const { activeCategoryFilter, isHidden, handleCategoryFilterClick } = props

    const queryIdByIndexName = useMemo(
        () =>
            new Map(scopedResults.map((r) => [r.indexId, r.results?.queryID])),
        [scopedResults]
    )

    // Listen to all clicks, if user clicks on a hit (and has consented to analytics - grep "hasClickAnalyticsConsent"),
    // Extract the pertinent hit data from the HTML and log the click to Algolia
    const handleHitClick = useCallback(
        (event: MouseEvent) => {
            let target = event.target as HTMLElement | null
            if (target) {
                let isHit = false
                while (target) {
                    if (target.hasAttribute("data-algolia-object-id")) {
                        isHit = true
                        break
                    }
                    target = target.parentElement
                }
                if (isHit && target) {
                    const objectId = target.getAttribute(
                        "data-algolia-object-id"
                    )
                    const eventName =
                        target.getAttribute("data-algolia-event-name") ??
                        undefined

                    const allVisibleHits = Array.from(
                        document.querySelectorAll(
                            ".search-results .ais-Hits-item a"
                        )
                    ).filter((e) => !isElementHidden(e))

                    // starts from 1 at the top of the page
                    const globalPosition = allVisibleHits.indexOf(target) + 1
                    // starts from 1 in each section
                    const positionInSection = target.getAttribute(
                        "data-algolia-position"
                    )

                    // Optional (only for explorers); Starts from 1
                    const cardPosition =
                        target.getAttribute("data-algolia-card-position") ??
                        undefined

                    // Optional (only for explorers); Starts from 1 in each card; or 0 for the full explorer link
                    const positionWithinCard =
                        target.getAttribute(
                            "data-algolia-position-within-card"
                        ) ?? undefined

                    const index = target.getAttribute("data-algolia-index")
                    const href = target.getAttribute("href")
                    const query = props.query
                    const queryID = index
                        ? queryIdByIndexName.get(index)
                        : undefined

                    if (
                        objectId &&
                        queryID &&
                        positionInSection &&
                        index &&
                        href &&
                        query
                    ) {
                        logSiteSearchClickToAlgoliaInsights({
                            eventName,
                            index,
                            queryID,
                            objectIDs: [objectId],
                            positions: [parseInt(positionInSection)],
                        })
                        siteAnalytics.logSearchClick({
                            query,
                            position: String(globalPosition),
                            positionInSection,
                            cardPosition,
                            positionWithinCard,
                            url: href,
                            filter: activeCategoryFilter,
                        })
                    }
                }
            }
        },
        [activeCategoryFilter, props.query, queryIdByIndexName]
    )
    useEffect(() => {
        document.addEventListener("click", handleHitClick)
        return () => document.removeEventListener("click", handleHitClick)
    }, [handleHitClick])

    const searchQueryRegionsMatches = useMemo(() => {
        const extractedRegions = extractRegionNamesFromSearchQuery(props.query)
        if (!extractedRegions) return undefined
        return sortBy(extractedRegions, (r) => r.name) // For some deterministic order
    }, [props.query])
    if (isHidden) return null

    const hasClickAnalyticsConsent = getPreferenceValue(
        PreferenceType.Analytics
    )

    return (
        <div
            className="search-results"
            data-active-filter={activeCategoryFilter}
        >
            <Index indexName={getIndexName(SearchIndexName.Pages)}>
                <Configure
                    hitsPerPage={40}
                    distinct
                    clickAnalytics={hasClickAnalyticsConsent}
                    // If we detect a country/region name in the query, we don't run a fulltext search
                    restrictSearchableAttributes={
                        searchQueryRegionsMatches
                            ? PAGES_ATTRIBUTES_TO_SEARCH_NO_FULLTEXT
                            : undefined
                    }
                />
                <NoResultsBoundary>
                    <section className="search-results__pages">
                        <header className="search-results__header-container">
                            <div className="search-results__header">
                                <h2 className="h2-bold search-results__section-title">
                                    Research & Writing
                                </h2>
                                <ShowMore
                                    category={SearchIndexName.Pages}
                                    cutoffNumber={4}
                                    activeCategoryFilter={activeCategoryFilter}
                                    handleCategoryFilterClick={
                                        handleCategoryFilterClick
                                    }
                                />
                            </div>
                        </header>
                        <Hits
                            classNames={{
                                root: "search-results__list-container",
                                list: "search-results__pages-list grid grid-cols-2 grid-sm-cols-1",
                                item: "search-results__page-hit",
                            }}
                            hitComponent={PagesHit}
                        />
                    </section>
                </NoResultsBoundary>
            </Index>
            <Index indexName={getIndexName(SearchIndexName.Charts)}>
                <Configure
                    hitsPerPage={40}
                    distinct
                    clickAnalytics={hasClickAnalyticsConsent}
                />
                <NoResultsBoundary>
                    <section className="search-results__charts">
                        <header className="search-results__header-container">
                            <div className="search-results__header">
                                <h2 className="h2-bold search-results__section-title">
                                    Charts
                                </h2>
                                <ShowMore
                                    category={SearchIndexName.Charts}
                                    cutoffNumber={4}
                                    activeCategoryFilter={activeCategoryFilter}
                                    handleCategoryFilterClick={
                                        handleCategoryFilterClick
                                    }
                                />
                            </div>
                        </header>
                        <Hits
                            classNames={{
                                root: "search-results__list-container",
                                list: "search-results__charts-list grid grid-cols-4 grid-sm-cols-2",
                                item: "search-results__chart-hit span-md-cols-2",
                            }}
                            hitComponent={ChartHit}
                        />
                    </section>
                </NoResultsBoundary>
            </Index>
            <Index indexName={getIndexName(SearchIndexName.ExplorerViews)}>
                <Configure
                    hitsPerPage={20}
                    clickAnalytics={hasClickAnalyticsConsent}
                />
                <NoResultsBoundary>
                    <section className="search-results__explorers">
                        <header className="search-results__header-container">
                            <div className="search-results__header">
                                <h2 className="h2-bold search-results__section-title">
                                    Data Explorers
                                </h2>
                                <ShowMore
                                    category={SearchIndexName.ExplorerViews}
                                    cutoffNumber={2}
                                    activeCategoryFilter={activeCategoryFilter}
                                    handleCategoryFilterClick={
                                        handleCategoryFilterClick
                                    }
                                    getTotalNumberOfHits={(
                                        results: AlgoliaSearchResultsType<IExplorerViewHit>
                                    ) => getNumberOfExplorerHits(results.hits)}
                                />
                            </div>
                            <h3 className="body-2-regular search-results__section-subtitle">
                                Interactive visualization tools to explore a
                                wide range of related indicators.
                            </h3>
                        </header>

                        <ExplorerViewHits
                            countriesRegionsToSelect={searchQueryRegionsMatches}
                        />
                    </section>
                </NoResultsBoundary>
            </Index>
            <section className="search-page__no-results">
                <div className="search-page__no-results-notice-container">
                    <FontAwesomeIcon icon={faSearch} />
                    <h2 className="body-1-regular">
                        There are no results for this query.
                    </h2>
                    <p className="body-3-medium">
                        You may want to try using different keywords or checking
                        for typos.
                    </p>
                </div>
            </section>
        </div>
    )
}

@observer
export class InstantSearchContainer extends React.Component {
    searchClient: SearchClient
    categoryFilterContainerRef: React.RefObject<HTMLUListElement>

    constructor(props: Record<string, never>) {
        super(props)
        this.searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
        this.categoryFilterContainerRef = React.createRef<HTMLUListElement>()
        this.handleCategoryFilterClick =
            this.handleCategoryFilterClick.bind(this)
    }

    componentDidMount(): void {
        const params = getWindowQueryParams()
        if (params.q) {
            // Algolia runs the search and fills the searchbox input regardless
            // we just need this class to be aware that a query exists so that it doesn't hide the results
            this.inputValue = params.q
        }
    }

    @observable inputValue: string = ""

    @action.bound handleQuery(query: string, search: (value: string) => void) {
        this.inputValue = query
        if (query === "") return
        search(query)
    }

    @observable activeCategoryFilter: SearchCategoryFilter = "all"

    @action.bound setActiveCategoryFilter(filter: SearchCategoryFilter) {
        this.activeCategoryFilter = filter
    }

    handleCategoryFilterClick(key: SearchCategoryFilter) {
        const ul = this.categoryFilterContainerRef.current
        if (!ul) return
        // On narrow screens, scroll horizontally to put the active tab at the left of the screen
        const hasScrollbar = document.body.scrollWidth < ul.scrollWidth
        if (hasScrollbar) {
            const target = [...ul.children].find(
                (node) => node.getAttribute("data-filter-key") === key
            ) as HTMLElement
            ul.scrollTo({
                // 16px for button padding
                left: target.offsetLeft - 16,
                behavior: "smooth",
            })
        }
        siteAnalytics.logSearchFilterClick({ key })
        this.setActiveCategoryFilter(key)
    }

    render() {
        return (
            <InstantSearch
                routing={{
                    // This controls algolia's automatic mapping of the search query to search params
                    // we're customizing it here to remove any filter / facet information so that it's just ?q=some+query
                    stateMapping: {
                        stateToRoute(uiState) {
                            const query = uiState[""].query
                            return {
                                q: query,
                            }
                        },
                        routeToState(routeState) {
                            const query = routeState.q
                            return {
                                "": {
                                    query: query,
                                },
                            }
                        },
                    },
                }}
                searchClient={this.searchClient}
            >
                <div className="search-panel">
                    <SearchBox
                        placeholder={DEFAULT_SEARCH_PLACEHOLDER}
                        className="searchbox"
                        queryHook={this.handleQuery}
                    />
                    <Filters
                        isHidden={!this.inputValue}
                        categoryFilterContainerRef={
                            this.categoryFilterContainerRef
                        }
                        activeCategoryFilter={this.activeCategoryFilter}
                        handleCategoryFilterClick={
                            this.handleCategoryFilterClick
                        }
                    />
                    <SearchResults
                        isHidden={!this.inputValue}
                        activeCategoryFilter={this.activeCategoryFilter}
                        query={this.inputValue}
                        handleCategoryFilterClick={
                            this.handleCategoryFilterClick
                        }
                    />
                    <PoweredBy />
                </div>
            </InstantSearch>
        )
    }
}

export function runSearchPage() {
    ReactDOM.render(<InstantSearchContainer />, document.querySelector("main"))
}
