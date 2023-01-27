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
                <SearchAutocomplete
                    placeholder="Poverty, CO2 emissions, ..."
                    className="SearchAutocomplete"
                    detachedMediaQuery="none"
                    openOnFocus
                    searchClient={searchClient}
                />
                <RefinementList attribute="_tags" />
                <Configure distinct={1} />
                <Index indexName={PAGES_INDEX}>
                    <Hits hitComponent={TopicCard}></Hits>
                </Index>
                <Index indexName={CHARTS_INDEX}>
                    <VirtualChartsRefinementList attribute="_tags" />
                    <SearchChartsHits />
                </Index>
            </InstantSearch>
        </div>
    )
}
