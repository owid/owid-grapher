import React from "react"
import {
    Configure,
    Hits,
    Index,
    InstantSearch,
    RefinementList,
} from "react-instantsearch-hooks-web"
import { TopicCard } from "./TopicCard.js"
import { SearchClient } from "algoliasearch/lite.js"
import { VirtualChartsRefinementList } from "./VirtualChartsRefinementList.js"
import { SearchChartsHits } from "./SearchChartsHits.js"
import { SearchAutocomplete } from "./SearchAutocomplete.js"
import "instantsearch.css/themes/satellite.css"

export const PAGES_INDEX = "pages-test"
export const CHARTS_INDEX = "charts-test"

export const SearchApp = ({ searchClient }: { searchClient: SearchClient }) => {
    return (
        <div className="SearchApp">
            <InstantSearch
                indexName={PAGES_INDEX}
                searchClient={searchClient}
                routing
            >
                <div className="search-header">
                    <div style={{ textAlign: "center" }}>
                        <h2>Search Our World in Data</h2>
                        <div>Free, open and ad-free</div>
                    </div>
                    <SearchAutocomplete
                        placeholder="Poverty, CO2 emissions, ..."
                        className="SearchAutocomplete"
                        detachedMediaQuery="none"
                        openOnFocus
                        searchClient={searchClient}
                    />
                </div>
                <div className="refinements">
                    <RefinementList attribute="_tags" />
                </div>
                <div className="search-results">
                    <Index indexName={PAGES_INDEX}>
                        <Configure filters="type:entry" distinct={1} />
                        <h3>Topics</h3>
                        <Hits hitComponent={TopicCard}></Hits>
                    </Index>
                    <Index indexName={CHARTS_INDEX}>
                        <h3>Interactive charts</h3>
                        <VirtualChartsRefinementList attribute="_tags" />
                        <SearchChartsHits />
                    </Index>
                </div>
            </InstantSearch>
        </div>
    )
}
