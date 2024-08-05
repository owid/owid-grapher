import React, { useEffect, useMemo, useRef, useState } from "react"
import ReactDOM from "react-dom"
import cx from "classnames"
import {
    get,
    isArray,
    TagGraphNode,
    TagGraphRoot,
    countriesByName,
    Country,
    Region,
} from "@ourworldindata/utils"
import {
    Configure,
    Hits,
    Index,
    InstantSearch,
    useInstantSearch,
    useSearchBox,
} from "react-instantsearch"
import algoliasearch from "algoliasearch"
import { ALGOLIA_ID, ALGOLIA_SEARCH_KEY } from "../settings/clientSettings.js"
import { SearchIndexName } from "./search/searchTypes.js"
import { getIndexName } from "./search/searchClient.js"
import { ScopedResult, UiState } from "instantsearch.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faClose,
    faMagnifyingGlass,
    faMapMarkerAlt,
} from "@fortawesome/free-solid-svg-icons"
import {
    useFocusTrap,
    useTriggerOnEscape,
    useTriggerWhenClickOutside,
} from "./hooks.js"
import { ChartHit } from "./search/ChartHit.js"

type FacetFilters = string | undefined | readonly (string | readonly string[])[]
function getRegionsFromSelectedEntitiesFacets(
    facetFilters: FacetFilters
): Region[] {
    const selectedEntities = parseFacetFilters(facetFilters).countries
    return selectedEntities.map((entity) => countriesByName()[entity])
}

const DataCatalogRibbon = ({
    tagName,
    addGlobalFacetFilter,
}: {
    tagName: string
    addGlobalFacetFilter: (x: string) => void
}) => {
    const { scopedResults, uiState } = useInstantSearch()
    const genericState = uiState[""]
    const countrySelections = getRegionsFromSelectedEntitiesFacets(
        genericState.configure?.facetFilters
    )

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
                    hitComponent={({ hit }: any) => (
                        <ChartHit
                            hit={hit}
                            searchQueryRegionsMatches={countrySelections}
                        />
                    )}
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
): string[] {
    return topics ? topics.split(",").map((tag) => "tags:" + tag) : []
}

function transformRouteCountriesToFacetFilters(
    countries: string | undefined
): string[] {
    return countries
        ? countries.split(",").map((country) => "availableEntities:" + country)
        : []
}

// takes the chaotically-typed facetFilters from instantsearch's UI state
// and returns a list of tags
// e.g. [["tags:Energy"], ["tags:Air Pollution"], ["availableEntities": "New Zealand"]] => { topics: ["Energy", "Air Pollution"], countries: ["New Zealand"] }
function parseFacetFilters(facetFilters: FacetFilters): {
    topics: string[]
    countries: string[]
} {
    if (!isArray(facetFilters)) return { topics: [], countries: [] }
    return facetFilters.flat<string[]>().reduce(
        (facets, filter: string) => {
            const match = filter.match(/^(tags|availableEntities):(.*)$/)
            if (match) {
                if (match[1] === "tags") facets.topics.push(match[2])
                if (match[1] === "availableEntities")
                    facets.countries.push(match[2])
            }
            return facets
        },
        { topics: [] as string[], countries: [] as string[] }
    )
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
    const countrySelections = getRegionsFromSelectedEntitiesFacets(
        genericState.configure?.facetFilters
    )
    const facetFilters = parseFacetFilters(genericState.configure?.facetFilters)
    const areaNames = tagGraph.children.map((child) => child.name)
    const isLoading = status === "loading" || status === "stalled"
    const shouldShowRibbons = checkShouldShowRibbonView(
        query,
        facetFilters.topics,
        areaNames
    )

    if (shouldShowRibbons)
        return (
            <DataCatalogRibbonView
                isLoading={isLoading}
                tagGraph={tagGraph}
                tagToShow={facetFilters.topics[0]}
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
                hitComponent={({ hit }: any) => (
                    <ChartHit
                        hit={hit}
                        searchQueryRegionsMatches={countrySelections}
                    />
                )}
            />
        </Index>
    )
}

function getNbHitsForTag(tag: string, results: ScopedResult[]) {
    const result = results.find((r) =>
        // for some reason I can only find facetFilters in the internal _state object
        parseFacetFilters(
            get(r, "results._state.facetFilters")
        ).topics.includes(tag)
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
        facetFilters.topics,
        areaNames
    )

    const appliedFiltersSection = (
        <ul className="span-cols-12 col-start-2 data-catalog-applied-filters-list">
            {facetFilters.topics.map((facetFilter) => (
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
        const areas = getAreaChildrenFromTag(tagGraph, facetFilters.topics[0])
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

function DataCatalogCountrySelector({
    countrySelections,
    setCountrySelections,
}: {
    countrySelections: Set<string>
    setCountrySelections: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [countrySearchQuery, setCountrySearchQuery] = useState("")
    const countrySelectorRef = useRef<HTMLDivElement>(null)
    const listContainerRef = useRef<HTMLDivElement>(null)
    useFocusTrap(listContainerRef, isOpen)
    useTriggerOnEscape(() => setIsOpen(false))
    useTriggerWhenClickOutside(countrySelectorRef, isOpen, () =>
        setIsOpen(false)
    )
    function handleCountrySelection(countryName: string) {
        setCountrySelections((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(countryName)) {
                newSet.delete(countryName)
            } else {
                newSet.add(countryName)
            }
            return newSet
        })
    }
    const alphabetizedCountriesByName = useMemo(() => {
        return Object.values(countriesByName()).sort((a, b) => {
            return a.name.localeCompare(b.name)
        })
    }, [])

    const filteredCountriesByName = useMemo(() => {
        return alphabetizedCountriesByName.filter(
            (country) =>
                countrySelections.has(country.name) ||
                country.name
                    .toLowerCase()
                    .includes(countrySearchQuery.toLowerCase())
        )
    }, [countrySearchQuery, countrySelections, alphabetizedCountriesByName])

    return (
        <div className="data-catalog-country-selector" ref={countrySelectorRef}>
            <button
                className="data-catalog-country-selector-button body-3-medium"
                aria-expanded={isOpen}
                aria-label={
                    isOpen ? "Close country selector" : "Open country selector"
                }
                onClick={() => setIsOpen(!isOpen)}
            >
                <FontAwesomeIcon icon={faMapMarkerAlt} />
                Country selector
            </button>
            {isOpen ? (
                <div
                    className="data-catalog-country-selector-list-container"
                    ref={listContainerRef}
                >
                    <div className="data-catalog-country-selector-header">
                        <h5 className="h5-black-caps data-catalog-country-selector__heading">
                            Select or search for a country
                        </h5>
                        <button
                            className="data-catalog-country-selector-close-button"
                            onClick={() => setIsOpen(false)}
                        >
                            <FontAwesomeIcon icon={faClose} />
                        </button>
                    </div>
                    <div className="data-catalog-country-selector-search-container">
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                        <input
                            type="text"
                            placeholder="Search for a country"
                            className="data-catalog-country-selector-search-input body-3-regular"
                            value={countrySearchQuery}
                            onChange={(e) =>
                                setCountrySearchQuery(e.target.value)
                            }
                        />
                    </div>
                    <ol className="data-catalog-country-selector-list">
                        {Object.values(filteredCountriesByName).map(
                            (country: Country) => (
                                <li
                                    value={country.name}
                                    key={country.name}
                                    className={cx(
                                        "data-catalog-country-selector-list__item",
                                        {
                                            "data-catalog-country-selector-list__item--selected":
                                                countrySelections.has(
                                                    country.name
                                                ),
                                        }
                                    )}
                                >
                                    <label
                                        className="body-3-medium"
                                        htmlFor={`country-${country.name}`}
                                    >
                                        <img
                                            className="flag"
                                            aria-hidden={true}
                                            height={16}
                                            width={20}
                                            src={`/images/flags/${country.code}.svg`}
                                        />
                                        {country.name}
                                    </label>
                                    <input
                                        type="checkbox"
                                        id={`country-${country.name}`}
                                        checked={countrySelections.has(
                                            country.name
                                        )}
                                        onChange={() => {
                                            handleCountrySelection(country.name)
                                        }}
                                    />
                                </li>
                            )
                        )}
                    </ol>
                </div>
            ) : null}
        </div>
    )
}

const SelectedCountriesPills = ({
    countrySelections,
    setCountrySelections,
}: {
    countrySelections: Set<string>
    setCountrySelections: React.Dispatch<React.SetStateAction<Set<string>>>
}) => {
    if (countrySelections.size === 0) return null
    return (
        <div className="data-catalog-selected-countries-container">
            {[...countrySelections].map((country) => (
                <div
                    key={country}
                    className="data-catalog-selected-country-pill"
                >
                    <img
                        width={20}
                        height={16}
                        src={`/images/flags/${countriesByName()[country].code}.svg`}
                    />
                    <span className="body-3-medium">{country}</span>
                    <button
                        onClick={() => {
                            setCountrySelections((prev) => {
                                const newSet = new Set(prev)
                                newSet.delete(country)
                                return newSet
                            })
                        }}
                    >
                        <FontAwesomeIcon icon={faClose} />
                    </button>
                </div>
            ))}
        </div>
    )
}

const DataCatalogSearchBox = () => {
    const { uiState } = useInstantSearch()
    const initValue = get(uiState, ["", "query"], "")
    const [query, setQuery] = useState(initValue)
    const sb = useSearchBox()

    return (
        <div className="data-catalog-search-box-container">
            <form
                className="data-catalog-search-form"
                onSubmit={(e) => {
                    e.preventDefault()
                    sb.refine(query)
                }}
            >
                <input
                    type="text"
                    className="data-catalog-search-input body-3-regular"
                    placeholder="Search for an indicator, a topic, or a keyword &hellip;"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                    }}
                />
            </form>
        </div>
    )
}

export const DataCatalog = (props: { tagGraph: TagGraphRoot }) => {
    const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    // TODO: setting these is causing the SearchBox value to reset to previous searches
    // investigate why this is happening
    // possibly switch setCountrySelections to use useInstantSearch().setUiState ?
    const [countrySelections, setCountrySelections] = useState<Set<string>>(
        new Set()
    )
    // globalFacetFilters apply to all indexes, unless they're overridden by a nested Configure component.
    // They're only relevant when we're not showing the ribbon view (because each ribbon has its own Configure.)
    // They're stored as ["Energy", "Air Pollution"] which is easier to work with in other components,
    // then are formatted into [["tags:Energy"], ["tags:Air Pollution"]] to be used in this component's Configure.
    const [globalFacetFilters, setGlobalFacetFilters] = useState<string[]>([])
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
    const formattedGlobalFacetFilters = globalFacetFilters.map((f) => [
        `tags:${f}`,
    ])
    const formattedCountrySelections = [...countrySelections].map((c) => [
        `availableEntities:${c}`,
    ])
    useEffect(() => {
        const handlePopState = () => {
            const urlParams = new URLSearchParams(window.location.search)
            const topics = urlParams.get("topics") || ""
            setGlobalFacetFilters(topics ? topics.split(",") : [])
            const countries = urlParams.get("countries") || ""
            setCountrySelections(new Set(countries ? countries.split(",") : []))
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
                        const topics: string = facetFilters.topics.join(",")
                        const countries = facetFilters.countries.join(",")

                        return {
                            q,
                            topics: topics.length ? topics : undefined,
                            countries: countries.length ? countries : undefined,
                        }
                    },
                    routeToState(routeState): UiState {
                        const facetFilters = [
                            ...transformRouteTopicsToFacetFilters(
                                routeState.topics
                            ),
                            ...transformRouteCountriesToFacetFilters(
                                routeState.countries
                            ),
                        ]
                        return {
                            "": {
                                configure: {
                                    facetFilters: facetFilters.length
                                        ? facetFilters
                                        : undefined,
                                },
                                query: routeState.q,
                            },
                        }
                    },
                },
            }}
        >
            <Configure
                facetFilters={[
                    ...formattedGlobalFacetFilters,
                    ...formattedCountrySelections,
                ]}
            />
            <div className="data-catalog-header span-cols-14 grid grid-cols-12-full-width">
                <header className="data-catalog-heading span-cols-12 col-start-2">
                    <h1 className="h1-semibold">Data Catalog</h1>
                    <p className="body-2-regular">
                        Select a country or an area of research to customize the
                        data catalogue or search for a specific indicator or
                        keyword to find what you’re looking for.
                    </p>
                </header>
                <div className="data-catalog-search-controls-container span-cols-12 col-start-2">
                    {/* Uses CSS to fake an input bar that will highlight correctly using focus-within
                        without highlighting when the country selector is focused
                     */}
                    <div className="data-catalog-pseudoform">
                        <SelectedCountriesPills
                            countrySelections={countrySelections}
                            setCountrySelections={setCountrySelections}
                        />
                        <DataCatalogSearchBox />
                    </div>
                    <DataCatalogCountrySelector
                        countrySelections={countrySelections}
                        setCountrySelections={setCountrySelections}
                    />
                </div>
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
