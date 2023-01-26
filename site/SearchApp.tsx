import React from "react"
import {
    Configure,
    Hits,
    InstantSearch,
    RefinementList,
} from "react-instantsearch-hooks-web"
import { TopicCard } from "./TopicCard.js"
import { SearchClient } from "algoliasearch/lite.js"
import { SearchAutocomplete } from "./SearchAutocomplete.js"

export const SearchApp = ({ searchClient }: { searchClient: SearchClient }) => {
    return (
        <div className="SearchApp">
            <InstantSearch
                indexName="pages"
                searchClient={searchClient}
                routing
            >
                <Configure distinct={1} />
                <SearchAutocomplete
                    placeholder="Poverty, CO2 emissions, ..."
                    className="SearchAutocomplete"
                    detachedMediaQuery="none"
                    openOnFocus
                />

                <RefinementList attribute="_tags" />
                <Hits hitComponent={TopicCard}></Hits>
            </InstantSearch>
        </div>
    )
}
