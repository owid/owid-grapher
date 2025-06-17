import * as _ from "lodash-es"
import { useCallback, useEffect, useMemo } from "react"
import * as React from "react"
import cx from "classnames"
import {
    getWindowQueryParams,
    isElementHidden,
    OwidGdocType,
} from "@ourworldindata/utils"
import {
    InstantSearch,
    Configure,
    SearchBox,
    Hits,
    Index,
    Snippet,
    useInstantSearch,
    PoweredBy,
} from "react-instantsearch"
import algoliasearch, { SearchClient } from "algoliasearch"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    IChartHit,
    SearchCategoryFilter,
    SearchIndexName,
    searchCategoryFilters,
    IPageHit,
    pageTypeDisplayNames,
    PageRecord,
    checkIsWordpressPageType,
} from "./searchTypes.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import {
    DEFAULT_SEARCH_PLACEHOLDER,
    getIndexName,
    logSiteSearchClickToAlgoliaInsights,
} from "./searchClient.js"
import { PreferenceType, getPreferenceValue } from "../cookiePreferences.js"
import type { SearchResults as AlgoliaSearchResultsType } from "algoliasearch-helper"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { extractRegionNamesFromSearchQuery } from "./searchUtils.js"
import { DEPRECATEDChartHit } from "./_DEPRECATEChartHit.js"
import DataInsightDateline from "../gdocs/components/DataInsightDateline.js"
import { getCanonicalUrl } from "@ourworldindata/components"

const siteAnalytics = new SiteAnalytics()

// The rule doesn't support class components in the same file.
// eslint-disable-next-line react-refresh/only-export-components
function PagesHit({ hit }: { hit: IPageHit }) {
    const dateline =
        hit.type === OwidGdocType.DataInsight && hit.date ? (
            <DataInsightDateline
                className="search-results__page-hit-dateline"
                publishedAt={new Date(hit.date)}
                formatOptions={{
                    year: "numeric",
                    month: "long",
                    day: "2-digit",
                }}
            />
        ) : null

    const href = checkIsWordpressPageType(hit.type)
        ? `/${hit.slug}`
        : getCanonicalUrl("", {
              slug: hit.slug,
              content: {
                  type: hit.type,
              },
          })
    return (
        <a
            href={href}
            data-algolia-index={getIndexName(SearchIndexName.Pages)}
            data-algolia-object-id={hit.objectID}
            data-algolia-position={hit.__position}
            className="search-results__page-hit-container"
        >
            {hit.thumbnailUrl && (
                <div className="search-results__page-hit-img-container">
                    <img
                        src={hit.thumbnailUrl}
                        role="presentation"
                        className="search-results__page-hit-img"
                    />
                </div>
            )}
            <div className="search-results__page-hit-text-container">
                <header className="page-hit__header">
                    {dateline}
                    <h4 className="h3-bold search-results__page-hit-title">
                        {hit.title}
                    </h4>
                    <span className="body-3-medium search-results__page-hit-type">
                        {pageTypeDisplayNames[hit.type]}
                    </span>
                </header>
                <Snippet
                    classNames={{
                        root: "body-3-medium search-results__page-hit-snippet",
                    }}
                    attribute="content"
                    highlightedTagName="strong"
                    hit={hit}
                />
            </div>
        </a>
    )
}

// The rule doesn't support class components in the same file.
// eslint-disable-next-line react-refresh/only-export-components
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

// The rule doesn't support class components in the same file.
// eslint-disable-next-line react-refresh/only-export-components
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

    const resultsByIndexName = _.keyBy(scopedResults, "indexId")
    const hitsLengthByIndexName = _.mapValues(resultsByIndexName, (results) =>
        _.get(results, ["results", "hits", "length"], 0)
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

// The rule doesn't support class components in the same file.
// eslint-disable-next-line react-refresh/only-export-components
function NoResultsBoundary({
    children,
}: {
    children: React.ReactElement<React.HTMLAttributes<HTMLElement>>
}) {
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

// The rule doesn't support class components in the same file.
// eslint-disable-next-line react-refresh/only-export-components
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
                            eventName: "click",
                            index,
                            queryID,
                            objectIDs: [objectId],
                            positions: [parseInt(positionInSection)],
                        })
                        siteAnalytics.logSearchClick({
                            query,
                            position: String(globalPosition),
                            positionInSection,
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
        return _.sortBy(extractedRegions, (r) => r.name) // For some deterministic order
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
            {/* This is using the InstantSearch index specified in InstantSearchContainer */}
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
            <Index
                indexName={getIndexName(
                    SearchIndexName.ExplorerViewsMdimViewsAndCharts
                )}
            >
                <Configure
                    hitsPerPage={40}
                    distinct
                    clickAnalytics={hasClickAnalyticsConsent}
                    restrictSearchableAttributes={
                        "" as any
                    } /* Hack: This is the only way to _not_ send `restrictSearchableAttributes` along for this index */
                />
                <NoResultsBoundary>
                    <section className="search-results__explorer-views-and-charts">
                        <header className="search-results__header-container">
                            <div className="search-results__header">
                                <h2 className="h2-bold search-results__section-title">
                                    Charts
                                </h2>
                                <ShowMore
                                    category={
                                        SearchIndexName.ExplorerViewsMdimViewsAndCharts
                                    }
                                    cutoffNumber={4}
                                    activeCategoryFilter={activeCategoryFilter}
                                    handleCategoryFilterClick={
                                        handleCategoryFilterClick
                                    }
                                />
                            </div>
                        </header>
                        <Hits<IChartHit>
                            classNames={{
                                root: "search-results__list-container",
                                list: "search-results__explorer-views-and-charts-list grid grid-cols-4 grid-sm-cols-2",
                                item: "list-style-none span-md-cols-2",
                            }}
                            hitComponent={(props) => (
                                <DEPRECATEDChartHit
                                    {...props}
                                    searchQueryRegionsMatches={
                                        searchQueryRegionsMatches
                                    }
                                />
                            )}
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
export class DEPRECATEDInstantSearchContainer extends React.Component {
    searchClient: SearchClient
    categoryFilterContainerRef = React.createRef<HTMLUListElement>()

    constructor(props: Record<string, never>) {
        super(props)

        makeObservable(this, {
            inputValue: observable,
            activeCategoryFilter: observable,
        })
        this.searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
        this.handleCategoryFilterClick =
            this.handleCategoryFilterClick.bind(this)
    }

    override componentDidMount(): void {
        const params = getWindowQueryParams()
        if (params.q) {
            // Algolia runs the search and fills the searchbox input regardless
            // we just need this class to be aware that a query exists so that it doesn't hide the results
            this.inputValue = params.q
        }
    }

    inputValue: string = ""

    @action.bound handleQuery(query: string, search: (value: string) => void) {
        this.inputValue = query
        if (query === "") return
        search(query)
    }

    activeCategoryFilter: SearchCategoryFilter = "all"

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

    override render() {
        return (
            <InstantSearch
                routing={{
                    // This controls algolia's automatic mapping of the search query to search params
                    // we're customizing it here to remove any filter / facet information so that it's just ?q=some+query
                    stateMapping: {
                        stateToRoute(uiState) {
                            const query =
                                uiState[getIndexName(SearchIndexName.Pages)]
                                    .query
                            return {
                                q: query,
                            }
                        },
                        routeToState(routeState) {
                            const query = routeState.q
                            return {
                                [getIndexName(SearchIndexName.Pages)]: {
                                    query: query,
                                },
                            }
                        },
                    },
                }}
                searchClient={this.searchClient}
                indexName={getIndexName(SearchIndexName.Pages)}
            >
                <div className="search-panel">
                    <SearchBox
                        autoFocus
                        placeholder={DEFAULT_SEARCH_PLACEHOLDER}
                        className="searchbox"
                        classNames={{
                            input: "search-panel-input",
                            reset: "search-panel-reset-button",
                        }}
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
