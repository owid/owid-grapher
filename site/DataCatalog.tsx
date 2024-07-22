import React, { useEffect } from "react"
import ReactDOM from "react-dom"
import {
    identity,
    slugify,
    TagGraphNode,
    TagGraphRoot,
    Url,
} from "@ourworldindata/utils"
import {
    Configure,
    Hits,
    Index,
    InstantSearch,
    RefinementList,
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
import { UiState } from "instantsearch.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronRight } from "@fortawesome/free-solid-svg-icons"

// SSR-safe way to get the current pathname
const usePathname = () => {
    if (typeof window !== "undefined") {
        return window.location.pathname
    }
    return ""
}

const pathJoin = (...subpaths: string[]) => {
    return subpaths.join("/").replace(/\/+/g, "/")
}

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
                src={`${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${hit.slug}`}
            />
            <p>{hit.title}</p>
        </a>
    )
}

const DataCatalogRibbon = (props: { tagName: string }) => {
    const { tagName } = props

    let newUrl = Url.fromURL(window.location.href)
    const currentPathname = newUrl.pathname!
    // hopefully temporary - we should just add slugs to each of the area tags
    // although, currently we assume tags with slugs are topics...
    const areaNameAsSlug = slugify(tagName)
    newUrl = newUrl.update({
        pathname: pathJoin(currentPathname, areaNameAsSlug),
    })

    return (
        <Index indexName={getIndexName(SearchIndexName.Charts)}>
            <Configure facetFilters={[`tags:${tagName}`]} hitsPerPage={4} />
            <div className="data-catalog-ribbon">
                <div className="data-catalog-ribbon__header">
                    <h2 className="body-1-regular">{tagName}</h2>
                    <a href={newUrl.fullUrl}>See all charts {">"}</a>
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

function getArea(
    subpaths: string[],
    tagGraph: TagGraphRoot
): TagGraphNode | undefined {
    return subpaths.reduce(
        (currentArea, childName) => {
            return currentArea?.children.find(
                (child) => slugify(child.name) === childName
            )
        },
        tagGraph as TagGraphNode | undefined
    )
}

const Breadcrumbs = ({
    subpaths,
    tagNamesBySlug,
}: {
    subpaths: string[]
    tagNamesBySlug: Record<string, string>
}) => {
    return (
        <div className="data-catalog-breadcrumbs span-cols-12 col-start-2">
            <span className="body-3-medium data-catalog-breadcrumb">
                <a className="" href="/charts">
                    All areas
                </a>
            </span>
            {subpaths.map((subpath, i) => {
                const path = subpaths.slice(0, i + 1).join("/")
                const isLast = i === subpaths.length - 1
                return (
                    <span
                        className="body-3-medium data-catalog-breadcrumb"
                        key={subpath}
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                        {isLast ? (
                            tagNamesBySlug[subpath]
                        ) : (
                            <a href={`/charts/${path}`}>
                                {tagNamesBySlug[subpath]}
                            </a>
                        )}
                    </span>
                )
            })}
        </div>
    )
}

const DataCatalogRibbonView = ({
    tagGraph,
    subpaths,
    tagNamesBySlug,
}: {
    tagGraph: TagGraphRoot
    tagNamesBySlug: Record<string, string>
    subpaths: string[]
}) => {
    let areas: TagGraphNode[] = []
    // if subpaths = [], we're on the landing page, render all areas
    if (subpaths.length === 0) {
        areas = tagGraph.children
    } else {
        const area = getArea(subpaths, tagGraph)
        areas = area ? area.children : []
    }
    if (areas.length === 0) {
        // TODO: what should we do here?
        return <div className="span-cols-12 col-start-2">Invalid area</div>
    }

    return (
        <div className="span-cols-12 col-start-2">
            <Breadcrumbs subpaths={subpaths} tagNamesBySlug={tagNamesBySlug} />
            {areas.map((area) => (
                <DataCatalogRibbon tagName={area.name} key={area.name} />
            ))}
        </div>
    )
}

const DataCatalogResults = ({
    subpaths,
    tagGraph,
    tagNamesBySlug,
}: {
    subpaths: string[]
    tagGraph: TagGraphRoot
    tagNamesBySlug: Record<string, string>
}) => {
    const { uiState } = useInstantSearch()
    const query = uiState[""].query
    const shouldAttemptRibbonsView = subpaths.length < 2 && !query
    const subpathsAsTagNames = subpaths.map(
        (subpath) => tagNamesBySlug[subpath]
    )

    if (shouldAttemptRibbonsView)
        return (
            <DataCatalogRibbonView
                tagGraph={tagGraph}
                subpaths={subpaths}
                tagNamesBySlug={tagNamesBySlug}
            />
        )

    return (
        <Index indexName={getIndexName(SearchIndexName.Charts)}>
            <Configure
                facetFilters={subpathsAsTagNames.map((tag) => `tags:${tag}`)}
                hitsPerPage={20}
            />
            <Breadcrumbs subpaths={subpaths} tagNamesBySlug={tagNamesBySlug} />
            <RefinementList
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
            />
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

function getTagNamesBySlug(tagGraph: TagGraphRoot): Record<string, string> {
    const tagNamesBySlug: Record<string, string> = {}
    function addTagNameBySlug(node: TagGraphNode) {
        if (node.slug) {
            tagNamesBySlug[node.slug] = node.name
        } else {
            tagNamesBySlug[slugify(node.name)] = node.name
        }
        node.children.forEach(addTagNameBySlug)
    }
    tagGraph.children.forEach(addTagNameBySlug)
    return tagNamesBySlug
}

export const DataCatalog = (props: { tagGraph: TagGraphRoot }) => {
    const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    const tagNamesBySlug = getTagNamesBySlug(props.tagGraph)
    const pathname = usePathname()
    const subpaths = pathname.split("/").filter(identity).slice(1)
    const areSubpathsValid = subpaths.every((part) => part in tagNamesBySlug)
    useEffect(() => {
        if (!areSubpathsValid) {
            history.replaceState(null, "", "/charts")
        }
    }, [areSubpathsValid])

    return (
        <InstantSearch
            searchClient={searchClient}
            routing={{
                stateMapping: {
                    stateToRoute(uiState) {
                        return {
                            // uiState is keyed by indexName, which is an empty string at this level
                            q: uiState[""].query,
                        }
                    },
                    routeToState(routeState): UiState {
                        return { "": { query: routeState.q } }
                    },
                },
            }}
        >
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
                subpaths={subpaths}
                tagNamesBySlug={tagNamesBySlug}
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
