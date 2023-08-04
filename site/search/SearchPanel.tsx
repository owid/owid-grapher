import ReactDOM from "react-dom"
import React from "react"
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
    setActiveCategoryFilter,
}: {
    category: SearchIndexName
    cutoffNumber: number
    activeCategoryFilter: SearchCategoryFilter
    setActiveCategoryFilter: (x: SearchIndexName) => void
}) {
    const { results } = useInstantSearch()
    // Don't show if we're on the same tab as the category this button is for
    if (activeCategoryFilter === category) return null
    if (results.hits.length === 0) return null
    const numberShowing =
        cutoffNumber < results.hits.length ? cutoffNumber : results.hits.length
    return (
        <div className="search-results__show-more-container">
            <em>
                Showing {numberShowing} out of {results.hits.length} results
            </em>
            <button onClick={() => setActiveCategoryFilter(category)}>
                Show all
            </button>
        </div>
    )
}

function Filters({
    setActiveCategoryFilter,
    activeCategoryFilter,
}: {
    activeCategoryFilter: SearchCategoryFilter
    setActiveCategoryFilter: (x: SearchCategoryFilter) => void
}) {
    const { scopedResults } = useInstantSearch()
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
            <div className="search-filters__tabs">
                {searchCategoryFilters.map(([label, key]) => (
                    <button
                        key={label}
                        disabled={hitsLengthByIndexName[key] === 0}
                        onClick={() => setActiveCategoryFilter(key)}
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
                ))}
            </div>
        </div>
    )
}

interface SearchResultsProps {
    isHidden: boolean
}

@observer
class SearchResults extends React.Component<SearchResultsProps> {
    constructor(props: SearchResultsProps) {
        super(props)
    }

    @observable activeCategoryFilter: SearchCategoryFilter = "all"

    @action.bound setActiveCategoryFilter(filter: SearchCategoryFilter) {
        this.activeCategoryFilter = filter
    }

    render() {
        if (this.props.isHidden) return null
        return (
            <div
                className="search-results"
                data-active-filter={this.activeCategoryFilter}
            >
                <Filters
                    activeCategoryFilter={this.activeCategoryFilter}
                    setActiveCategoryFilter={this.setActiveCategoryFilter}
                />
                {/* This is using the InstantSearch index */}
                <Configure hitsPerPage={40} distinct />

                <div className="search-results__pages">
                    <header className="search-results__header">
                        <h2 className="h2-bold search-results__section-title">
                            Research & Writing
                        </h2>
                        <ShowMore
                            category={SearchIndexName.Pages}
                            cutoffNumber={4}
                            activeCategoryFilter={this.activeCategoryFilter}
                            setActiveCategoryFilter={
                                this.setActiveCategoryFilter
                            }
                        />
                    </header>
                    <Hits
                        classNames={{
                            root: "search-results__pages-list-container",
                            list: "search-results__pages-list grid grid-cols-2 grid-cols-sm-1",
                            item: "search-results__page-hit",
                        }}
                        hitComponent={PagesHit}
                    />
                </div>
                <div className="search-results__explorers">
                    <Index indexName={SearchIndexName.Explorers}>
                        <header className="search-results__header">
                            <h2 className="h2-bold search-results__section-title">
                                Data Explorers
                            </h2>
                            <ShowMore
                                category={SearchIndexName.Explorers}
                                cutoffNumber={2}
                                activeCategoryFilter={this.activeCategoryFilter}
                                setActiveCategoryFilter={
                                    this.setActiveCategoryFilter
                                }
                            />
                        </header>
                        <Configure hitsPerPage={10} distinct />
                        <Hits
                            classNames={{
                                root: "search-results__explorers-list-container",
                                list: "search-results__explorers-list grid grid-cols-2 grid-cols-sm-1",
                                item: "search-results__explorer-hit",
                            }}
                            hitComponent={ExplorersHit}
                        />
                    </Index>
                </div>
                <div className="search-results__charts">
                    <Index indexName={SearchIndexName.Charts}>
                        <header className="search-results__header">
                            <h2 className="h2-bold search-results__section-title">
                                Charts
                            </h2>
                            <ShowMore
                                category={SearchIndexName.Charts}
                                cutoffNumber={15}
                                activeCategoryFilter={this.activeCategoryFilter}
                                setActiveCategoryFilter={
                                    this.setActiveCategoryFilter
                                }
                            />
                        </header>
                        <Configure hitsPerPage={40} distinct />
                        <Hits
                            classNames={{
                                root: "search-results__charts-list-container",
                                list: "search-results__charts-list grid grid-cols-4 grid-cols-sm-2",
                                item: "search-results__chart-hit",
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

    constructor(props: Record<string, never>) {
        super(props)
        this.searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY, {})
    }

    @observable inputValue: string = ""

    @action.bound handleQuery(query: string, search: (value: string) => void) {
        this.inputValue = query
        if (query) {
            search(query)
        }
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
                    <SearchResults isHidden={!this.inputValue} />
                </div>
            </InstantSearch>
        )
    }
}

export function runSearchPage() {
    ReactDOM.render(<InstantSearchContainer />, document.querySelector("main"))
}
