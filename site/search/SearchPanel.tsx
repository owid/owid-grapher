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
    RefinementList,
    useRefinementList,
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

function PagesHit({ hit }: { hit: any }) {
    return (
        <a href={`${BAKED_BASE_URL}/${hit.slug}`}>
            {/* TODO: index featured images */}
            <header className="page-hit__header">
                <h4 className="h3-bold search-panel__page-hit-title">
                    {hit.title}
                </h4>
                <span className="body-3-medium search-panel__page-hit-type">
                    {hit.type === "article" ? "Article" : "Topic page"}
                </span>
            </header>
            <Snippet
                className="body-3-medium search-panel__page-hit-snippet"
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
            <img src={`${BAKED_GRAPHER_URL}/exports/${hit.slug}.svg`} />
            <Highlight
                attribute="title"
                highlightedTagName="strong"
                className="search-panel__chart-hit-highlight"
                hit={hit}
            />
        </a>
    )
}

function ExplorersHit({ hit }: { hit: any }) {
    return (
        <a href={hit.slug}>
            <h4 className="h3-bold">{hit.title}</h4>
            <p className="body-3-medium">{hit.subtitle}</p>
        </a>
    )
}

function ShowMore({
    toggleIsExpanded,
    isExpanded,
}: {
    toggleIsExpanded: () => void
    isExpanded: boolean
}) {
    const { results } = useInstantSearch()
    return !isExpanded ? (
        <div className="search-panel__show-more-container">
            <em>Showing 4 out of {results.hits.length} results</em>
            {/* TODO: make this switch to R&W tab instead */}
            <button onClick={toggleIsExpanded}>Show all</button>
        </div>
    ) : (
        <div className="search-panel__show-more-container">
            <em>Showing {results.hits.length} results</em>
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
        <div className="search-panel__filters-container">
            <div className="search-panel__content-filter-container">
                {searchCategoryFilters.map(([label, key]) => (
                    <button
                        key={label}
                        disabled={hitsLengthByIndexName[key] === 0}
                        onClick={() => setActiveCategoryFilter(key)}
                        className={cx("search-panel__content-filter-button", {
                            "search-panel__content-filter-button--is-active":
                                activeCategoryFilter === key,
                        })}
                    >
                        {label}
                        <span className="search-panel__content-filter-count">
                            {hitsLengthByIndexName[key]}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}

@observer
export class InstantSearchContainer extends React.Component {
    searchClient: SearchClient

    constructor(props: Record<string, never>) {
        super(props)
        this.searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY, {})
    }

    @observable inputValue: string = ""
    @observable isPagesExpanded: boolean = false
    @observable activeCategoryFilter: SearchCategoryFilter = "all"

    @action.bound handleQuery(query: string, search: (value: string) => void) {
        this.inputValue = query
        this.isPagesExpanded = false
        if (query) {
            search(query)
        }
    }

    @action.bound toggleIsPagesExpanded() {
        this.isPagesExpanded = !this.isPagesExpanded
    }

    @action.bound setActiveCategoryFilter(filter: SearchCategoryFilter) {
        this.activeCategoryFilter = filter
    }

    render() {
        return (
            <InstantSearch
                searchClient={this.searchClient}
                indexName={SearchIndexName.Pages}
            >
                <div className="search-panel">
                    <div
                        className="search-panel__results"
                        data-active-filter={this.activeCategoryFilter}
                    >
                        <SearchBox
                            placeholder="Try “COVID”, “Poverty”, “New Zealand”, “CO2 emissions per capita”..."
                            className="searchbox"
                            queryHook={this.handleQuery}
                        />
                        {/* TODO: lift out into <SearchResults /> component to remove ternary */}
                        {this.inputValue ? (
                            <>
                                <Filters
                                    activeCategoryFilter={
                                        this.activeCategoryFilter
                                    }
                                    setActiveCategoryFilter={
                                        this.setActiveCategoryFilter
                                    }
                                />
                                {/* This is using the InstantSearch index */}
                                <Configure hitsPerPage={20} distinct={1} />

                                <div className="search-panel__pages">
                                    <header className="search-panel__header">
                                        <h2 className="h2-bold search-panel__section-title">
                                            Research & Writing
                                        </h2>
                                        <ShowMore
                                            isExpanded={this.isPagesExpanded}
                                            toggleIsExpanded={
                                                this.toggleIsPagesExpanded
                                            }
                                        />
                                    </header>
                                    <RefinementList attribute="tags" />
                                    <Hits
                                        classNames={{
                                            root: cx({
                                                "search-panel__pages-list-container":
                                                    true,
                                                "search-panel__pages-list-container--is-expanded":
                                                    this.isPagesExpanded,
                                            }),
                                            list: "search-panel__pages-list grid grid-cols-2 grid-cols-sm-1",
                                            item: "search-panel__page-hit",
                                        }}
                                        hitComponent={PagesHit}
                                    />
                                </div>
                                <div className="search-panel__explorers">
                                    <h2 className="h2-bold search-panel__section-title">
                                        Data Explorers
                                    </h2>
                                    <Index
                                        indexName={SearchIndexName.Explorers}
                                    >
                                        <Configure
                                            hitsPerPage={2}
                                            distinct={1}
                                        />
                                        <Hits
                                            classNames={{
                                                root: "search-panel__explorers-list-container",
                                                list: "search-panel__explorers-list grid grid-cols-2 grid-cols-sm-1",
                                                item: "search-panel__explorer-hit",
                                            }}
                                            hitComponent={ExplorersHit}
                                        />
                                    </Index>
                                </div>
                                <div className="search-panel__charts">
                                    <h2 className="h2-bold search-panel__section-title">
                                        Charts
                                    </h2>
                                    <Index indexName={SearchIndexName.Charts}>
                                        <RefinementList attribute="tags" />
                                        <Configure
                                            hitsPerPage={20}
                                            distinct={1}
                                        />
                                        <Hits
                                            classNames={{
                                                root: "search-panel__charts-list-container",
                                                list: "search-panel__charts-list grid grid-cols-4 grid-cols-sm-2",
                                                item: "search-panel__chart-hit",
                                            }}
                                            hitComponent={ChartHit}
                                        />
                                    </Index>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </InstantSearch>
        )
    }
}

export function runSearchPage() {
    ReactDOM.render(<InstantSearchContainer />, document.querySelector("main"))
}
