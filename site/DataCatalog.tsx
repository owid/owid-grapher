import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import {
    excludeNullish,
    identity,
    isArray,
    TagGraphNode,
    TagGraphRoot,
} from "@ourworldindata/utils"
import {
    Configure,
    Hits,
    Index,
    InstantSearch,
    RefinementList,
    SearchBox,
    useConfigure,
    useInstantSearch,
    useRefinementList,
} from "react-instantsearch"
import algoliasearch from "algoliasearch"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.js"
import { SearchIndexName } from "./search/searchTypes.js"
import { getIndexName } from "./search/searchClient.js"
import { UiState } from "instantsearch.js"

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
    setGlobalFacetFilters,
}: {
    tagName: string
    setGlobalFacetFilters: (facetFilters: string[]) => void
}) => {
    return (
        <Index indexName={getIndexName(SearchIndexName.Charts)}>
            <Configure facetFilters={[`tags:${tagName}`]} hitsPerPage={4} />
            <div className="data-catalog-ribbon">
                <div className="data-catalog-ribbon__header">
                    <h2 className="body-1-regular">{tagName}</h2>
                    <a
                        href={`/charts?topics=${tagName}`}
                        onClick={(e) => {
                            e.preventDefault()
                            setGlobalFacetFilters([`tags:${tagName}`])
                        }}
                    >
                        See all charts {">"}
                    </a>
                </div>
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

const DataCatalogRibbonView = ({
    tagGraph,
    tagToShow,
    setGlobalFacetFilters,
}: {
    tagGraph: TagGraphRoot
    tagToShow: string | undefined
    setGlobalFacetFilters: (facetFilters: string[]) => void
}) => {
    const areas: TagGraphNode[] = []
    if (tagToShow) {
        const tagNode = tagGraph.children.find(
            (child) => child.name === tagToShow
        )
        if (tagNode) areas.push(...tagNode.children)
    } else {
        areas.push(...tagGraph.children)
    }

    return (
        <div className="span-cols-12 col-start-2">
            {areas.map((area) => (
                <DataCatalogRibbon
                    tagName={area.name}
                    key={area.name}
                    setGlobalFacetFilters={setGlobalFacetFilters}
                />
            ))}
        </div>
    )
}

// "Energy and Environment, Air Pollution" => ["tags:Energy and Environment", "tags:Air Pollution"]
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

const DataCatalogResults = ({
    tagGraph,
    setGlobalFacetFilters,
}: {
    tagGraph: TagGraphRoot
    setGlobalFacetFilters: (facetFilters: string[]) => void
}) => {
    const { uiState } = useInstantSearch()
    const genericState = uiState[""]
    const query = genericState.query
    const facetFilters = parseFacetFilters(genericState.configure?.facetFilters)
    const areaNames = tagGraph.children.map((child) => child.name)
    const shouldShowRibbons =
        !query && checkIfNoFacetsOrOneAreaFacetApplied(facetFilters, areaNames)

    if (shouldShowRibbons)
        return (
            <DataCatalogRibbonView
                tagGraph={tagGraph}
                tagToShow={facetFilters[0]}
                setGlobalFacetFilters={setGlobalFacetFilters}
            />
        )

    return (
        <Index indexName={getIndexName(SearchIndexName.Charts)}>
            {/* <Configure hitsPerPage={2} /> */}
            {/* <RefinementList
                attribute="tags"
                className="data-catalog-facets span-cols-12 col-start-2"
                classNames={{
                    list: "data-catalog-facets-list",
                    item: "data-catalog-facets-list-item",
                    label: "data-catalog-facets-list-item__label",
                    labelText: "data-catalog-facets-list-item__label-text",
                    count: "data-catalog-facets-list-item__count",
                    checkbox: "data-catalog-facets-list-item__checkbox",
                }}
            /> */}
            <Hits
                classNames={{
                    root: "data-catalog-search-hits span-cols-12 col-start-2",
                    item: "data-catalog-search-hit",
                    list: "data-catalog-search-list grid grid-cols-4",
                }}
                hitComponent={({ hit }: any) => <ChartHit hit={hit} />}
            />
            <pre
                className="span-cols-12 col-start-2"
                style={{ margin: "48px 0" }}
            >
                TODO: pagination?
            </pre>
        </Index>
    )
}

const TopicsRefinementList = () => {
    const configure = useConfigure({})
    return (
        <div className="span-cols-12 col-start-2">
            <button
                onClick={() => {
                    configure.refine({
                        hitsPerPage: 4,
                    })
                }}
            >
                4 hits
            </button>
            <button
                onClick={() => {
                    configure.refine({
                        facetFilters: ["tags:Artificial Intelligence"],
                    })
                }}
            >
                AI
            </button>
        </div>
    )
}

export const DataCatalog = (props: { tagGraph: TagGraphRoot }) => {
    const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    const [globalFacetFilters, setGlobalFacetFilters] = useState<
        string[] | undefined
    >()
    useEffect(() => {
        const handlePopState = () => {
            const urlParams = new URLSearchParams(window.location.search)
            const topics = urlParams.get("topics") || ""
            setGlobalFacetFilters(transformRouteTopicsToFacetFilters(topics))
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
            <Configure facetFilters={globalFacetFilters} />
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
            <DataCatalogResults
                tagGraph={props.tagGraph}
                setGlobalFacetFilters={setGlobalFacetFilters}
            />
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
