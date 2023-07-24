import ReactDOM from "react-dom"
import React from "react"
import cx from "classnames"
// import { getWindowQueryParams } from "@ourworldindata/utils"
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

function PagesHit({ hit }: { hit: any }) {
    return (
        <a href={`${BAKED_BASE_URL}/${hit.slug}`}>
            <div className="page-hit">
                {/* TODO: index featured images */}
                <h4 className="h3-bold page-hit__title">
                    <Highlight
                        attribute="title"
                        highlightedTagName="strong"
                        hit={hit}
                    />
                    <span className="body-3-medium page-hit__page-type">
                        {hit.type === "article" ? "Article" : "Topic page"}
                    </span>
                </h4>
                <p className="body-3-medium page-hit__snippet">
                    <Snippet
                        attribute="excerpt"
                        highlightedTagName="strong"
                        hit={hit}
                    />
                </p>
            </div>
        </a>
    )
}

function ChartHit({ hit }: { hit: any }) {
    return (
        <a href={`${BAKED_GRAPHER_URL}/${hit.slug}`}>
            <img src={`${BAKED_GRAPHER_URL}/exports/${hit.slug}.svg`} />
            <p>
                <Highlight attribute="title" hit={hit} />
            </p>
        </a>
    )
}

function ExplorersHit({ hit }: { hit: any }) {
    return (
        <a className="explorer-hit" href={hit.slug}>
            <div>
                <h4 className="h3-bold">
                    <Highlight attribute="title" hit={hit} />
                </h4>
                <p className="body-3-medium">
                    <Highlight attribute="subtitle" hit={hit} />
                </p>
            </div>
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
            <p>Showing 4 out of {results.hits.length} results</p>
            <button onClick={toggleIsExpanded}>Show all</button>
        </div>
    ) : (
        <div className="search-panel__show-more-container">
            <p>Showing {results.hits.length} results</p>
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

    render() {
        return (
            <InstantSearch searchClient={this.searchClient} indexName="pages">
                <div className="search-panel">
                    <div className="search-panel__results">
                        <SearchBox
                            placeholder="Try “COVID”, “Poverty”, “New Zealand”, “CO2 emissions per capita”..."
                            className="searchbox"
                            queryHook={this.handleQuery}
                        />
                        {/* TODO: lift out into <SearchResults /> component to remove ternary */}
                        {this.inputValue ? (
                            <>
                                <Index indexName="pages">
                                    <Configure hitsPerPage={20} distinct={1} />
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
                                    <Hits
                                        classNames={{
                                            root: cx({
                                                "search-panel__pages-container":
                                                    true,
                                                "search-panel__pages-container--is-expanded":
                                                    this.isPagesExpanded,
                                            }),
                                            list: "search-panel__pages-list grid grid-cols-2 grid-cols-sm-1",
                                            item: "search-panel__page-item",
                                        }}
                                        hitComponent={PagesHit}
                                    />
                                </Index>
                                <h2 className="h2-bold search-panel__section-title">
                                    Data Explorers
                                </h2>
                                <Index indexName="explorers-test">
                                    <Configure hitsPerPage={2} distinct={1} />

                                    <Hits
                                        classNames={{
                                            root: "search-panel__explorers-container",
                                            list: "search-panel__explorers-list grid grid-cols-2 grid-cols-sm-1",
                                            item: "search-panel__explorer-item",
                                        }}
                                        hitComponent={ExplorersHit}
                                    />
                                </Index>
                                <h2 className="h2-bold search-panel__section-title">
                                    Charts
                                </h2>
                                <Index indexName="charts">
                                    <Configure hitsPerPage={20} distinct={1} />
                                    <Hits
                                        classNames={{
                                            root: "search-panel__charts-container",
                                            list: "search-panel__charts-list grid grid-cols-4 grid-cols-sm-2",
                                            item: "search-panel__chart-item",
                                        }}
                                        hitComponent={ChartHit}
                                    />
                                </Index>
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
