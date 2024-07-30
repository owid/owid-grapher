import React, { useEffect, useState } from "react"
import cx from "classnames"
import ReactDOM from "react-dom"
import { get, isArray, TagGraphNode, TagGraphRoot } from "@ourworldindata/utils"
import {
    Configure,
    Hits,
    Index,
    InstantSearch,
    SearchBox,
    useInstantSearch,
} from "react-instantsearch"
import algoliasearch from "algoliasearch"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.js"
import { SearchIndexName } from "./search/searchTypes.js"
import { getIndexName } from "./search/searchClient.js"
import { ScopedResult, UiState } from "instantsearch.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight, faClose } from "@fortawesome/free-solid-svg-icons"

const ChartHit = ({ hit }: { hit: any }) => {
    return (
        <a
            key={hit.title}
            href={`/grapher/${hit.slug}`}
            className="data-catalog-ribbon-thumbnail"
        >
            <img
                height={150}
                width={212.5}
                src={`${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${hit.slug}.png`}
            />
            <p>{hit.title}</p>
        </a>
    )
}

const DataCatalogRibbon = ({
    tagName,
    addGlobalFacetFilter,
}: {
    tagName: string
    addGlobalFacetFilter: (x: string) => void
}) => {
    const { scopedResults } = useInstantSearch()
    return (
        <Index indexName={getIndexName(SearchIndexName.Charts)}>
            <Configure facetFilters={[`tags:${tagName}`]} hitsPerPage={4} />
            <div className="data-catalog-ribbon">
                <a
                    href={`/charts?topics=${tagName}`}
                    onClick={(e) => {
                        e.preventDefault()
                        addGlobalFacetFilter(tagName)
                    }}
                >
                    <div className="data-catalog-ribbon__header">
                        <h2 className="body-1-regular">{tagName}</h2>
                        <span className="data-catalog-ribbon__hit-count body-2-semibold">
                            {getNbHitsForTag(tagName, scopedResults)} indicators
                            <FontAwesomeIcon icon={faArrowRight} />
                        </span>
                    </div>
                </a>
                <Hits
                    classNames={{
                        root: "data-catalog-ribbon-hits",
                        item: "data-catalog-ribbon-hit",
                        list: "data-catalog-ribbon-list grid grid-cols-4",
                    }}
                    hitComponent={({ hit }: any) => <ChartHit hit={hit} />}
                />
            </div>
        </Index>
    )
}

function getAreaChildrenFromTag(
    tagGraph: TagGraphRoot,
    tag: string | undefined
) {
    const areas: TagGraphNode[] = []
    if (tag) {
        const tagNode = tagGraph.children.find((child) => child.name === tag)
        if (tagNode) areas.push(...tagNode.children)
    } else {
        areas.push(...tagGraph.children)
    }
    return areas
}

const DataCatalogRibbonView = ({
    tagGraph,
    tagToShow,
    addGlobalFacetFilter,
    isLoading,
}: {
    tagGraph: TagGraphRoot
    tagToShow: string | undefined
    addGlobalFacetFilter: (x: string) => void
    isLoading: boolean
}) => {
    const areas = getAreaChildrenFromTag(tagGraph, tagToShow)

    return (
        <div
            className={cx("span-cols-12 col-start-2 data-catalog-ribbons", {
                "data-catalog-ribbons--is-loading": isLoading,
            })}
        >
            {areas.map((area) => (
                <DataCatalogRibbon
                    tagName={area.name}
                    key={area.name}
                    addGlobalFacetFilter={addGlobalFacetFilter}
                />
            ))}
        </div>
    )
}

// "Energy and Environment, Air Pollution" => ["Energy and Environment", "Air Pollution"]
// Currently unclear why this seems to work even though I thought it should be string[][]
function transformRouteTopicsToFacetFilters(
    topics: string | undefined
): string[] | undefined {
    return topics ? topics.split(",").map((tag) => "tags:" + tag) : undefined
}

// takes the chaotically-typed facetFilters from instantsearch's UI state
// and returns a list of tags
// e.g. [["tags:Energy"], ["tags:Air Polluion"]] => ["Energy", "Air Pollution"]
function parseFacetFilters(
    facetFilters: string | undefined | readonly (string | readonly string[])[]
): string[] {
    if (!isArray(facetFilters)) return []
    return facetFilters
        .flat<string[]>()
        .reduce((tags: string[], filter: string) => {
            const match = filter.match(/^tags:(.*)$/)
            if (match) tags.push(match[1])
            return tags
        }, [])
}

// facetFilters is usually something like [["tags:Energy"], ["tags:Air Polluion"]]
// This function checks to see if it's [["tags:Health"]] (or any other area tag) or []
// which are the two cases in which we show the ribbon view
function checkIfNoFacetsOrOneAreaFacetApplied(
    facetFilters: string[],
    areas: string[]
) {
    if (facetFilters.length === 0) return true
    if (facetFilters.length > 1) return false

    const [tag] = facetFilters
    return areas.includes(tag)
}

function checkShouldShowRibbonView(
    query: string | undefined,
    facetFilters: string[],
    areas: string[]
) {
    return !query && checkIfNoFacetsOrOneAreaFacetApplied(facetFilters, areas)
}

const DataCatalogResults = ({
    tagGraph,
    addGlobalFacetFilter,
}: {
    tagGraph: TagGraphRoot
    addGlobalFacetFilter: (tag: string) => void
}) => {
    const { uiState, status } = useInstantSearch()
    const genericState = uiState[""]
    const query = genericState.query
    const facetFilters = parseFacetFilters(genericState.configure?.facetFilters)
    const areaNames = tagGraph.children.map((child) => child.name)
    const isLoading = status === "loading" || status === "stalled"
    const shouldShowRibbons = checkShouldShowRibbonView(
        query,
        facetFilters,
        areaNames
    )

    if (shouldShowRibbons)
        return (
            <DataCatalogRibbonView
                isLoading={isLoading}
                tagGraph={tagGraph}
                tagToShow={facetFilters[0]}
                addGlobalFacetFilter={addGlobalFacetFilter}
            />
        )

    return (
        <Index indexName={getIndexName(SearchIndexName.Charts)}>
            <Hits
                classNames={{
                    root: cx(
                        "data-catalog-search-hits span-cols-12 col-start-2",
                        {
                            "data-catalog-search-hits--is-loading": isLoading,
                        }
                    ),
                    item: "data-catalog-search-hit",
                    list: "data-catalog-search-list grid grid-cols-4",
                }}
                hitComponent={({ hit }: any) => <ChartHit hit={hit} />}
            />
        </Index>
    )
}

function getNbHitsForTag(tag: string, results: ScopedResult[]) {
    const result = results.find((r) =>
        // for some reason I can only find facetFilters in the internal _state object
        parseFacetFilters(get(r, "results._state.facetFilters")).includes(tag)
    )
    return result ? result.results.nbHits : undefined
}

const DataCatalogLoadingSpinner = () => {
    const { status } = useInstantSearch()
    if (status === "loading" || status === "stalled") {
        return (
            <div className="data-catalog-loading-spinner span-cols-12 col-start-2">
                <div className="data-catalog-loading-spinner__spinner"></div>
            </div>
        )
    }
    return null
}

const TopicsRefinementList = ({
    tagGraph,
    addGlobalFacetFilter,
    removeGlobalFacetFilter,
}: {
    tagGraph: TagGraphRoot
    addGlobalFacetFilter: (tag: string) => void
    removeGlobalFacetFilter: (tag: string) => void
}) => {
    const { uiState, scopedResults, status } = useInstantSearch()
    const genericState = uiState[""]
    const areaNames = tagGraph.children.map((child) => child.name)
    const facetFilters = parseFacetFilters(genericState.configure?.facetFilters)
    const isLoading = status === "loading" || status === "stalled"
    const isShowingRibbons = checkShouldShowRibbonView(
        genericState.query,
        facetFilters,
        areaNames
    )

    const appliedFiltersSection = (
        <ul className="span-cols-12 col-start-2 data-catalog-applied-filters-list">
            {facetFilters.map((facetFilter) => (
                <li
                    key={facetFilter}
                    className="data-catalog-applied-filters-item"
                >
                    <button
                        className="data-catalog-applied-filters-button body-3-medium"
                        onClick={() => {
                            removeGlobalFacetFilter(facetFilter)
                        }}
                    >
                        {facetFilter}
                        <FontAwesomeIcon icon={faClose} />
                    </button>
                </li>
            ))}
        </ul>
    )
    if (isShowingRibbons) {
        const areas = getAreaChildrenFromTag(tagGraph, facetFilters[0])
        return (
            <React.Fragment>
                {appliedFiltersSection}
                <ul
                    className={cx(
                        "span-cols-12 col-start-2 data-catalog-facets-list",
                        {
                            "data-catalog-facets-list--is-loading": isLoading,
                        }
                    )}
                >
                    {areas.map((area, i) => {
                        const isLast = i === areas.length - 1
                        return (
                            <React.Fragment key={area.name}>
                                <li
                                    key={area.name}
                                    className="data-catalog-facets-list-item"
                                    tabIndex={0}
                                    onClick={() => {
                                        addGlobalFacetFilter(area.name)
                                    }}
                                >
                                    <span>{area.name}</span>
                                    <span className="data-catalog-facets-list-item__hit-count">
                                        (
                                        {getNbHitsForTag(
                                            area.name,
                                            scopedResults
                                        )}
                                        )
                                    </span>
                                </li>
                                {!isLast ? (
                                    <li
                                        className="data-catalog-facets-list-separator"
                                        // including an empty space so that the list has spaces in it when copied to clipboard
                                    >
                                        {" "}
                                    </li>
                                ) : null}
                            </React.Fragment>
                        )
                    })}
                </ul>
            </React.Fragment>
        )
    }
    return (
        <div className="span-cols-12 col-start-2">{appliedFiltersSection}</div>
    )
}

export const DataCatalog = (props: { tagGraph: TagGraphRoot }) => {
    const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    // globalFacetFilters apply to all indexes, unless they're overridden by a nested Configure component.
    // They're only relevant when we're not showing the ribbon view (because each ribbon has its own Configure.)
    // They're stored as ["Energy", "Air Pollution"] which is easier to work with in other components,
    // then are formatted into [["tags:Energy"], ["tags:Air Pollution"]] to be used in this component's Configure.
    const [globalFacetFilters, setGlobalFacetFilters] = useState<
        string[] | undefined
    >()
    function addGlobalFacetFilter(tag: string) {
        setGlobalFacetFilters((prev) => {
            if (!prev) return [tag]
            if (prev.includes(tag)) return prev
            return prev.concat(tag)
        })
    }
    function removeGlobalFacetFilter(tag: string) {
        setGlobalFacetFilters((prev) => {
            if (!prev) return []
            return prev.filter((t) => t !== tag)
        })
    }
    const formattedGlobalFacetFilters = globalFacetFilters?.map((f) => [
        `tags:${f}`,
    ])
    useEffect(() => {
        const handlePopState = () => {
            const urlParams = new URLSearchParams(window.location.search)
            const topics = urlParams.get("topics") || ""
            setGlobalFacetFilters(topics ? topics.split(",") : undefined)
        }
        window.addEventListener("popstate", handlePopState)
        handlePopState()
        return () => {
            window.removeEventListener("popstate", handlePopState)
        }
    }, [])

    return (
        <InstantSearch
            searchClient={searchClient}
            routing={{
                stateMapping: {
                    stateToRoute(uiStates) {
                        // uiStates are keyed by indexName, which is an empty string at this level
                        const genericState = uiStates[""]
                        const q = genericState.query
                        const facetFilters = parseFacetFilters(
                            genericState.configure?.facetFilters
                        )
                        const topics: string = facetFilters.join(",")

                        return {
                            q,
                            topics: topics.length ? topics : undefined,
                        }
                    },
                    routeToState(routeState): UiState {
                        return {
                            "": {
                                configure: {
                                    facetFilters:
                                        transformRouteTopicsToFacetFilters(
                                            routeState.topics
                                        ),
                                },
                                query: routeState.q,
                            },
                        }
                    },
                },
            }}
        >
            <Configure facetFilters={formattedGlobalFacetFilters} />
            <div className="data-catalog-header span-cols-14 grid grid-cols-12-full-width">
                <header className="data-catalog-heading span-cols-12 col-start-2">
                    <h1 className="h1-semibold">Data Catalog</h1>
                    <p className="body-2-regular">
                        Select a country or an area of research to customize the
                        data catalogue or search for a specific indicator or
                        keyword to find what you’re looking for.
                    </p>
                </header>
                <SearchBox
                    placeholder="Search for an indicator, a topic, or a keyword &hellip;"
                    searchAsYouType={false}
                    classNames={{
                        form: "data-catalog-search-form",
                    }}
                    className="span-cols-12 col-start-2"
                />
            </div>
            <TopicsRefinementList
                tagGraph={props.tagGraph}
                addGlobalFacetFilter={addGlobalFacetFilter}
                removeGlobalFacetFilter={removeGlobalFacetFilter}
            />
            <DataCatalogResults
                tagGraph={props.tagGraph}
                addGlobalFacetFilter={addGlobalFacetFilter}
            />
            <DataCatalogLoadingSpinner />
        </InstantSearch>
    )
}

export function hydrateChartsPage() {
    const root = document.getElementById("charts-index-page-root")
    const tagGraph = window._OWID_TAG_GRAPH as TagGraphRoot
    if (root) {
        ReactDOM.hydrate(<DataCatalog tagGraph={tagGraph} />, root)
    }
}
