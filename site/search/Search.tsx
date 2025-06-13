import { TagGraphRoot, TagGraphNode } from "@ourworldindata/types"
import { Url } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"
import { useReducer, useMemo, useEffect } from "react"
import { DataCatalogRibbonView } from "./DataCatalogRibbonView.js"
import { DataCatalogResults } from "./DataCatalogResults.js"
import { Searchbar } from "./Searchbar.js"
import { SearchResultType } from "./SearchResultTypeToggle.js"
import { SearchTopicsRefinementList } from "./SearchTopicsRefinementList.js"
import {
    searchReducer,
    createActions,
    searchStateToUrl,
    urlToSearchState,
} from "./searchState.js"
import { SearchState, FilterType } from "./searchTypes.js"
import {
    checkShouldShowRibbonView,
    syncDataCatalogURL,
    getFilterNamesOfType,
} from "./searchUtils.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { AsDraft } from "../AsDraft/AsDraft.js"
import { match } from "ts-pattern"
import { SearchContext } from "./SearchContext.js"

const analytics = new SiteAnalytics()

export const Search = ({
    initialState,
    tagGraph,
    searchClient,
}: {
    initialState: SearchState
    tagGraph: TagGraphRoot
    searchClient: SearchClient
}) => {
    const [state, dispatch] = useReducer(searchReducer, initialState)
    const actions = useMemo(() => createActions(dispatch), [dispatch])

    const AREA_NAMES = useMemo(
        () => tagGraph.children.map((child) => child.name),
        [tagGraph]
    )

    const ALL_TOPICS = useMemo(() => {
        function getAllTopics(node: TagGraphNode): Set<string> {
            return node.children.reduce((acc, child) => {
                if (child.isTopic) {
                    acc.add(child.name)
                }
                if (child.children.length) {
                    const topics = getAllTopics(child)
                    topics.forEach((topic) => acc.add(topic))
                }
                return acc
            }, new Set<string>())
        }
        return Array.from(getAllTopics(tagGraph))
    }, [tagGraph])

    const shouldShowRibbons = useMemo(
        () =>
            checkShouldShowRibbonView(
                state.query,
                new Set(getFilterNamesOfType(state.filters, FilterType.TOPIC)),
                AREA_NAMES
            ),
        [state.query, state.filters, AREA_NAMES]
    )

    const stateAsUrl = searchStateToUrl(state)

    useEffect(() => {
        const url = Url.fromURL(window.location.href)
        const urlState = urlToSearchState(url)
        actions.setState(urlState)
    }, [actions])

    useEffect(() => {
        // Reconstructing state from the `stateAsUrl` serialization to avoid a `state` dependency in this effect,
        // which would cause it to run on every state change (even no-ops)
        const url = Url.fromURL(stateAsUrl)
        const state = urlToSearchState(url)
        analytics.logDataCatalogSearch(state)
    }, [stateAsUrl])

    useEffect(() => {
        syncDataCatalogURL(stateAsUrl)
    }, [stateAsUrl])

    useEffect(() => {
        const handlePopState = () => {
            const url = Url.fromURL(window.location.href)
            actions.setState(urlToSearchState(url))
        }
        window.addEventListener("popstate", handlePopState)
        return () => {
            window.removeEventListener("popstate", handlePopState)
        }
    }, [actions])

    const searchSelection = {
        shouldShowRibbons,
    }

    return (
        <SearchContext.Provider value={{ state, actions }}>
            <div className="data-catalog-header span-cols-14 grid grid-cols-12-full-width">
                <header className="data-catalog-heading span-cols-12 col-start-2">
                    <h1 className="h1-semibold">Data Catalog</h1>
                    <p className="body-2-regular">
                        Search for a specific chart, or browse all our charts by
                        area and topic.
                    </p>
                </header>
                <div className="data-catalog-search-controls-container span-cols-12 col-start-2">
                    <Searchbar allTopics={ALL_TOPICS} />
                </div>
            </div>
            <SearchTopicsRefinementList
                searchClient={searchClient}
                tagGraph={tagGraph}
                shouldShowRibbons={shouldShowRibbons}
            />
            <AsDraft
                className="col-start-11 span-cols-3 as-draft--align-self-start"
                name="Search result type"
            >
                <SearchResultType />
            </AsDraft>
            {match(searchSelection)
                .with({ shouldShowRibbons: true }, () => (
                    <DataCatalogRibbonView
                        tagGraph={tagGraph}
                        searchClient={searchClient}
                    />
                ))
                .with({ shouldShowRibbons: false }, () => (
                    <DataCatalogResults searchClient={searchClient} />
                ))
                .exhaustive()}
        </SearchContext.Provider>
    )
}
