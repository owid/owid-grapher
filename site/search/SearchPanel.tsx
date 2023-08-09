import ReactDOM from "react-dom"
import React, { useRef } from "react"
import cx from "classnames"
import {
    keyBy,
    reduce,
    getWindowQueryParams,
    get,
    mapValues,
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
} from "react-instantsearch-hooks-web"
import algoliasearch, { SearchClient } from "algoliasearch"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../../settings/clientSettings.js"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import {
    SearchCategoryFilter,
    SearchIndexName,
    searchCategoryFilters,
} from "./searchTypes.js"
import { EXPLORERS_ROUTE_FOLDER } from "../../explorer/ExplorerConstants.js"

function PagesHit({ hit }: { hit: any }) {
    return (
        <a href={`${BAKED_BASE_URL}/${hit.slug}`}>
            {/* TODO: index featured images */}
            <header className="page-hit__header">
                <h4 className="h3-bold search-results__page-hit-title">
                    {hit.title}
                </h4>
                <span className="body-3-medium search-results__page-hit-type">
                    {hit.type === "article" ? "Article" : "Topic page"}
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

function ChartHit({ hit }: { hit: any }) {
    return (
        <a href={`${BAKED_GRAPHER_URL}/${hit.slug}`}>
            <div className="search-results__chart-hit-img-container">
                <img
                    loading="lazy"
                    src={`${BAKED_GRAPHER_URL}/exports/${hit.slug}.svg`}
                />
            </div>
            <Highlight
                attribute="title"
                highlightedTagName="strong"
                className="search-results__chart-hit-highlight"
                hit={hit}
            />
        </a>
    )
}

function ExplorersHit({ hit }: { hit: any }) {
    return (
        <a href={`${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${hit.slug}`}>
            <h4 className="h3-bold">{hit.title}</h4>
            {/* Explorer subtitles are mostly useless at the moment, so we're only showing titles */}
        </a>
    )
}

function ShowMore({
    category,
    cutoffNumber,
    activeCategoryFilter,
    handleCategoryFilterClick,
}: {
    category: SearchIndexName
    cutoffNumber: number
    activeCategoryFilter: SearchCategoryFilter
    handleCategoryFilterClick: (x: SearchIndexName) => void
}) {
    const { results } = useInstantSearch()
    // Hide if we're on the same tab as the category this button is for
    if (activeCategoryFilter === category) return null
    if (results.hits.length === 0) return null

    const handleClick = () => {
        window.scrollTo({ top: 0, behavior: "smooth" })
        // Skip timeout if we're already at/near the top of the page
        const timeout = window.scrollY > 100 ? 500 : 0
        setTimeout(() => {
            // Show the user we're back at the top of the page before updating the tab
            handleCategoryFilterClick(category)
        }, timeout)
    }

    const numberShowing = Math.min(cutoffNumber, results.hits.length)
    return (
        <div className="search-results__show-more-container">
            <em>
                Showing {numberShowing} out of {results.hits.length} results
            </em>
            <button onClick={handleClick}>Show all</button>
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
    hitsLengthByIndexName.all = reduce(
        hitsLengthByIndexName,
        (a: number, b: number) => a + b,
        0
    )

    return (
        <div className="search-filters">
            <ul
                ref={categoryFilterContainerRef}
                className="search-filters__list"
            >
                {searchCategoryFilters.map(([label, key]) => (
                    <li
                        key={key}
                        data-filter-key={key}
                        className="search-filters__tab"
                    >
                        <button
                            disabled={hitsLengthByIndexName[key] === 0}
                            onClick={() => handleCategoryFilterClick(key)}
                            className={cx("search-filters__tab-button", {
                                "search-filters__tab-button--is-active":
                                    activeCategoryFilter === key,
                            })}
                        >
                            {label}
                            <span className="search-filters__tab-count">
                                {hitsLengthByIndexName[key]}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

interface SearchResultsProps {
    activeCategoryFilter: SearchCategoryFilter
    isHidden: boolean
    handleCategoryFilterClick: (x: SearchCategoryFilter) => void
}

@observer
class SearchResults extends React.Component<SearchResultsProps> {
    constructor(props: SearchResultsProps) {
        super(props)
    }

    render() {
        const { activeCategoryFilter, isHidden, handleCategoryFilterClick } =
            this.props
        if (isHidden) return null
        return (
            <div
                className="search-results"
                data-active-filter={activeCategoryFilter}
            >
                {/* This is using the InstantSearch index */}
                <Configure hitsPerPage={40} distinct />

                <div className="search-results__pages">
                    <header className="search-results__header">
                        <h2 className="h2-bold search-results__section-title">
                            Research & Writing
                        </h2>
                    </header>
                    <ShowMore
                        category={SearchIndexName.Pages}
                        cutoffNumber={4}
                        activeCategoryFilter={activeCategoryFilter}
                        handleCategoryFilterClick={handleCategoryFilterClick}
                    />
                    <Hits
                        classNames={{
                            root: "search-results__list-container",
                            list: "search-results__pages-list grid grid-cols-2 grid-cols-sm-1",
                            item: "search-results__page-hit span-md-cols-2",
                        }}
                        hitComponent={PagesHit}
                    />
                </div>
                <div className="search-results__explorers">
                    <Index indexName={SearchIndexName.Explorers}>
                        <Configure hitsPerPage={10} distinct />
                        <header className="search-results__header">
                            <h2 className="h2-bold search-results__section-title">
                                Data Explorers
                            </h2>
                        </header>
                        <ShowMore
                            category={SearchIndexName.Explorers}
                            cutoffNumber={2}
                            activeCategoryFilter={activeCategoryFilter}
                            handleCategoryFilterClick={
                                handleCategoryFilterClick
                            }
                        />
                        <Hits
                            classNames={{
                                root: "search-results__list-container",
                                list: "search-results__explorers-list grid grid-cols-2 grid-sm-cols-1",
                                item: "search-results__explorer-hit",
                            }}
                            hitComponent={ExplorersHit}
                        />
                    </Index>
                </div>
                <div className="search-results__charts">
                    <Index indexName={SearchIndexName.Charts}>
                        <Configure hitsPerPage={40} distinct />
                        <header className="search-results__header">
                            <h2 className="h2-bold search-results__section-title">
                                Charts
                            </h2>
                        </header>
                        <ShowMore
                            category={SearchIndexName.Charts}
                            cutoffNumber={15}
                            activeCategoryFilter={activeCategoryFilter}
                            handleCategoryFilterClick={
                                handleCategoryFilterClick
                            }
                        />
                        <Hits
                            classNames={{
                                root: "search-results__list-container",
                                list: "search-results__charts-list grid grid-cols-4 grid-sm-cols-2",
                                item: "search-results__chart-hit span-md-cols-2",
                            }}
                            hitComponent={ChartHit}
                        />
                    </Index>
                </div>
            </div>
        )
    }
}

@observer
export class InstantSearchContainer extends React.Component {
    searchClient: SearchClient
    categoryFilterContainerRef: React.RefObject<HTMLUListElement>

    constructor(props: Record<string, never>) {
        super(props)
        this.searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY, {})
        this.categoryFilterContainerRef = React.createRef<HTMLUListElement>()
        this.handleCategoryFilterClick =
            this.handleCategoryFilterClick.bind(this)
    }

    @observable inputValue: string = ""

    @action.bound handleQuery(query: string, search: (value: string) => void) {
        this.inputValue = query
        if (query) {
            search(query)
        }
    }

    @observable activeCategoryFilter: SearchCategoryFilter = "all"

    @action.bound setActiveCategoryFilter(filter: SearchCategoryFilter) {
        this.activeCategoryFilter = filter
    }

    handleCategoryFilterClick(key: SearchCategoryFilter) {
        const ul = this.categoryFilterContainerRef.current
        if (!ul) return
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
        this.setActiveCategoryFilter(key)
    }

    render() {
        return (
            <InstantSearch
                searchClient={this.searchClient}
                indexName={SearchIndexName.Pages}
            >
                <div className="search-panel">
                    <SearchBox
                        placeholder="Try “COVID”, “Poverty”, “New Zealand”, “CO2 emissions per capita”..."
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
                        handleCategoryFilterClick={
                            this.handleCategoryFilterClick
                        }
                    />
                </div>
            </InstantSearch>
        )
    }
}

export function runSearchPage() {
    ReactDOM.render(<InstantSearchContainer />, document.querySelector("main"))
}
