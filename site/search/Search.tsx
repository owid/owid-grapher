import { TagGraphNode, TagGraphRoot } from "@ourworldindata/types"
import { Url } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"
import { useReducer, useMemo, useEffect } from "react"
import { Searchbar } from "./Searchbar.js"
import { SearchTopicsRefinementList } from "./SearchTopicsRefinementList.js"
import {
    searchReducer,
    createActions,
    searchStateToUrl,
    urlToSearchState,
} from "./searchState.js"
import {
    SearchState,
    FilterType,
    TemplateConfig,
    SearchResultType,
} from "./searchTypes.js"
import {
    syncDataCatalogURL,
    getFilterNamesOfType,
    getSelectedTopicType,
} from "./searchUtils.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { AsDraft } from "../AsDraft/AsDraft.js"
import { SearchContext } from "./SearchContext.js"
import { SearchResultTypeToggle } from "./SearchResultTypeToggle.js"
import { match } from "ts-pattern"
import { SearchTemplatesAll } from "./SearchTemplatesAll.js"
import { SearchTemplatesData } from "./SearchTemplatesData.js"
import { SearchTemplatesWriting } from "./SearchTemplatesWriting.js"

const analytics = new SiteAnalytics()

export const Search = ({
    initialState,
    topicTagGraph,
    searchClient,
}: {
    initialState: SearchState
    topicTagGraph: TagGraphRoot
    searchClient: SearchClient
}) => {
    const [state, dispatch] = useReducer(searchReducer, initialState)
    const actions = useMemo(() => createActions(dispatch), [dispatch])

    const AREA_NAMES = useMemo(
        () => topicTagGraph.children.map((child) => child.name) || [],
        [topicTagGraph]
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
        return [...getAllTopics(topicTagGraph)]
    }, [topicTagGraph])

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

    const templateConfig: TemplateConfig = {
        resultType: state.resultType,
        topicType: getSelectedTopicType(state.filters, AREA_NAMES),
        hasCountry:
            getFilterNamesOfType(state.filters, FilterType.COUNTRY).size > 0,
        hasQuery: state.query.length > 0,
    }

    return (
        <SearchContext.Provider
            value={{
                state,
                actions,
                searchClient,
                templateConfig,
                topicTagGraph,
            }}
        >
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
            <SearchTopicsRefinementList />
            <AsDraft
                className="col-start-11 span-cols-3 as-draft--align-self-start"
                name="Search result type"
            >
                <SearchResultTypeToggle />
            </AsDraft>
            {match(templateConfig.resultType)
                .with(SearchResultType.ALL, () => <SearchTemplatesAll />)
                .with(SearchResultType.DATA, () => <SearchTemplatesData />)
                .with(SearchResultType.WRITING, () => (
                    <SearchTemplatesWriting />
                ))
                .exhaustive()}
        </SearchContext.Provider>
    )
}
