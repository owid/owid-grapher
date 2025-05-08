import { TagGraphRoot } from "@ourworldindata/types"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { Search } from "./Search.js"
import { getInitialDatacatalogState } from "./searchState.js"
import algoliasearch from "algoliasearch"

export const SearchInstantSearchWrapper = ({
    tagGraph,
}: {
    tagGraph: TagGraphRoot
}) => {
    const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    const initialState = getInitialDatacatalogState()

    return (
        <Search
            initialState={initialState}
            tagGraph={tagGraph}
            searchClient={searchClient}
        />
    )
}
