import React, { useEffect, useMemo, useReducer, useRef, useState } from "react"
import { simple } from "instantsearch.js/es/lib/stateMappings"
import { history } from "instantsearch.js/es/lib/routers"
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
    cloneDeep,
    debounce,
} from "@ourworldindata/utils"
import { LabeledSwitch } from "@ourworldindata/components"
import {
    Configure,
    Hits,
    Index,
    InstantSearch,
    SearchBox,
    useConfigure,
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
import { RouterProps } from "instantsearch.js/es/middlewares/createRouterMiddleware.js"

type FacetFilters = string | undefined | readonly (string | readonly string[])[]

function getRegionsFromSelectedEntitiesFacets(
    facetFilters: FacetFilters
): Region[] {
    const selectedEntities = parseFacetFilters(facetFilters).countries
    return selectedEntities.map((entity) => countriesByName()[entity])
}

const DataCatalogRibbon = ({
    tagName,
    addGlobalTagFilter,
}: {
    tagName: string
    addGlobalTagFilter: (x: string) => void
}) => {
    const { scopedResults, uiState } = useInstantSearch()
    const nBHits = getNbHitsForTag(tagName, scopedResults)
    const genericState = uiState[""]
    const countrySelections = getRegionsFromSelectedEntitiesFacets(
        genericState.configure?.facetFilters
    )

    if (nBHits === 0) {
        return null
    }

    return (
        <Index indexName={CHARTS_INDEX}>
            {/* <Configure facetFilters={[`tags:${tagName}`]} hitsPerPage={4} /> */}
            <div className="data-catalog-ribbon">
                <a
                    href={`/charts?topics=${tagName}`}
                    onClick={(e) => {
                        e.preventDefault()
                        addGlobalTagFilter(tagName)
                    }}
                >
                    <div className="data-catalog-ribbon__header">
                        <h2 className="body-1-regular">{tagName}</h2>
                        <span className="data-catalog-ribbon__hit-count body-2-semibold">
                            {nBHits} indicators
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
    addGlobalTagFilter,
    isLoading,
}: {
    tagGraph: TagGraphRoot
    tagToShow: string | undefined
    addGlobalTagFilter: (x: string) => void
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
                    addGlobalTagFilter={addGlobalTagFilter}
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
// TODO: is this handling the disjunctive case correctly?
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
    addGlobalTagFilter,
}: {
    tagGraph: TagGraphRoot
    addGlobalTagFilter: (tag: string) => void
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
                addGlobalTagFilter={addGlobalTagFilter}
            />
        )

    return (
        <Index indexName={CHARTS_INDEX}>
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
    // addGlobalTagFilter,
    // removeGlobalTagFilter,
}: {
    tagGraph: TagGraphRoot
    // addGlobalTagFilter: (tag: string) => void
    // removeGlobalTagFilter: (tag: string) => void
}) => {
    const { uiState, scopedResults, status, setIndexUiState } =
        useInstantSearch()
    console.log("TopicsRefinementList uiState", uiState)
    const genericState = uiState[CHARTS_INDEX]
    const areaNames = tagGraph.children.map((child) => child.name)
    const facetFilters = parseFacetFilters(genericState.configure?.facetFilters)
    console.log("TopicsRefinementList facetFilters", facetFilters)
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
                            setIndexUiState((prev) => {
                                console.log("returning prev", prev)
                                return prev
                                const newUiState = cloneDeep(prev)
                                const globalConfigure = newUiState.configure
                                if (
                                    !globalConfigure ||
                                    !globalConfigure.facetFilters ||
                                    !isArray(globalConfigure.facetFilters)
                                ) {
                                    return newUiState
                                }

                                newUiState.configure = {
                                    ...globalConfigure,
                                    facetFilters:
                                        globalConfigure.facetFilters.filter(
                                            (f: string | string[]) => {
                                                if (isArray(f)) {
                                                    return (
                                                        f[0].slice(5) !==
                                                        facetFilter
                                                    )
                                                }
                                                return (
                                                    f.slice(5) !== facetFilter
                                                )
                                            }
                                        ),
                                }
                                return newUiState
                            })

                            // removeGlobalTagFilter(facetFilter)
                        }}
                    >
                        {facetFilter}
                        <FontAwesomeIcon icon={faClose} />
                    </button>
                </li>
            ))}
        </ul>
    )
    // if (isShowingRibbons) {
    //     const areas = getAreaChildrenFromTag(tagGraph, facetFilters.topics[0])
    //     return (
    //         <React.Fragment>
    //             {appliedFiltersSection}
    //             <ul
    //                 className={cx(
    //                     "span-cols-12 col-start-2 data-catalog-refinement-list",
    //                     {
    //                         "data-catalog-refinement-list__is-loading": isLoading,
    //                     }
    //                 )}
    //             >
    //                 {areas.map((area, i) => {
    //                     const isLast = i === areas.length - 1
    //                     const nBHits = getNbHitsForTag(area.name, scopedResults)
    //                     if (nBHits === 0) return null
    //                     return (
    //                         <React.Fragment key={area.name}>
    //                             <li
    //                                 key={area.name}
    //                                 className="data-catalog-refinement-list__list-item"
    //                                 tabIndex={0}
    //                                 onClick={() => {
    //                                     addGlobalTagFilter(area.name)
    //                                 }}
    //                             >
    //                                 <span>{area.name}</span>
    //                                 <span className="data-catalog-refinement-list__list-item-hit-count">
    //                                     ({nBHits})
    //                                 </span>
    //                             </li>
    //                             {!isLast ? (
    //                                 <li
    //                                     className="data-catalog-refinement-list__separator"
    //                                     // including an empty space so that the list has spaces in it when copied to clipboard
    //                                 >
    //                                     {" "}
    //                                 </li>
    //                             ) : null}
    //                         </React.Fragment>
    //                     )
    //                 })}
    //             </ul>
    //         </React.Fragment>
    //     )
    // }
    return (
        <div className="span-cols-12 col-start-2">{appliedFiltersSection}</div>
    )
}

function DataCatalogCountrySelector({
    countrySelections,
    setCountrySelections,
    shouldAllCountriesMatch,
    handleToggleRequireAllCountries,
}: {
    countrySelections: Set<string>
    setCountrySelections: React.Dispatch<React.SetStateAction<Set<string>>>
    shouldAllCountriesMatch: boolean
    handleToggleRequireAllCountries: () => void
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
                    <LabeledSwitch
                        className="data-catalog-country-selector-switch"
                        value={shouldAllCountriesMatch}
                        onToggle={() => handleToggleRequireAllCountries()}
                        label="Only show charts with data for selected countries"
                    />
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
    const initValue = get(uiState, [CHARTS_INDEX, "query"], "")
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

const REQUIRE_ALL_COUNTRIES_QUERY_PARAM = "requireAllCountries"

export const DataCatalog = (props: { tagGraph: TagGraphRoot }) => {
    const [countrySelections, setCountrySelections] = useState<Set<string>>(
        new Set()
    )
    const [
        mustHaveDataForAllSelectedCountries,
        setMustHaveDataForAllSelectedCountries,
    ] = useState(
        typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).has(
                REQUIRE_ALL_COUNTRIES_QUERY_PARAM
            )
    )
    const handleToggleRequireAllCountries = () => {
        setMustHaveDataForAllSelectedCountries(
            !mustHaveDataForAllSelectedCountries
        )

        const urlParams = new URLSearchParams(window.location.search)
        if (mustHaveDataForAllSelectedCountries) {
            urlParams.delete(REQUIRE_ALL_COUNTRIES_QUERY_PARAM)
        } else {
            urlParams.set(REQUIRE_ALL_COUNTRIES_QUERY_PARAM, "true")
        }
        window.history.pushState(
            {},
            "",
            `${window.location.pathname}?${urlParams}`
        )
    }

    // globalFacetFilters apply to all indexes, unless they're overridden by a nested Configure component.
    // They're only relevant when we're not showing the ribbon view (because each ribbon has its own Configure.)
    // They're stored as ["Energy", "Air Pollution"] which is easier to work with in other components,
    // then are formatted into [["tags:Energy"], ["tags:Air Pollution"]] to be used in this component's Configure.

    // const [globalTagFilters, setGlobalTagFilters] = useState<string[]>([])
    // function addGlobalTagFilter(tag: string) {
    //     setGlobalTagFilters((prev) => {
    //         if (!prev) return [tag]
    //         if (prev.includes(tag)) return prev
    //         return prev.concat(tag)
    //     })
    // }
    // function removeGlobalTagFilter(tag: string) {
    //     setGlobalTagFilters((prev) => {
    //         if (!prev) return []
    //         return prev.filter((t) => t !== tag)
    //     })
    // }

    // const facetFilters = globalTagFilters.map((f) => [`tags:${f}`])
    // // conjunction mode (A AND B): [[attribute:"A"], [attribute:"B"]]
    // if (mustHaveDataForAllSelectedCountries) {
    //     for (const c of countrySelections) {
    //         facetFilters.push([`availableEntities:${c}`])
    //     }
    // } else {
    //     // disjunction mode (A OR B): [[attribute:"A", attribute:"B"]]
    //     const orFacets: string[] = []
    //     for (const c of countrySelections) {
    //         orFacets.push(`availableEntities:${c}`)
    //     }
    //     if (orFacets.length) {
    //         facetFilters.push(orFacets)
    //     }
    // }

    // const { setIndexUiState } = useInstantSearch()

    // useEffect(() => {
    //     const handlePopState = () => {
    //         const urlParams = new URLSearchParams(window.location.search)
    //         const topics = urlParams.get("topics") || ""
    //         console.log("topics", topics)
    //         // const countries = urlParams.get("countries") || ""
    //         // setCountrySelections(new Set(countries ? countries.split(",") : []))
    //         // setIndexUiState((prev) => {
    //         //     const newState = cloneDeep(prev)
    //         //     newState.configure = {
    //         //         ...newState.configure,
    //         //         facetFilters: [
    //         //             ...transformRouteTopicsToFacetFilters(topics),
    //         //             // ...transformRouteCountriesToFacetFilters(countries),
    //         //         ],
    //         //     }
    //         //     return newState
    //         // })
    //     }
    //     window.addEventListener("popstate", handlePopState)
    //     return () => {
    //         window.removeEventListener("popstate", handlePopState)
    //     }
    // }, [])

    return (
        <>
            {/* <Configure facetFilters={facetFilters} /> */}
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
                    {/* 
                        Uses CSS to fake an input bar that will highlight correctly using :focus-within
                        without highlighting when the country selector is focused
                     */}
                    <div className="data-catalog-pseudo-input">
                        <SelectedCountriesPills
                            countrySelections={countrySelections}
                            setCountrySelections={setCountrySelections}
                        />
                        <DataCatalogSearchBox />
                    </div>
                    <DataCatalogCountrySelector
                        shouldAllCountriesMatch={
                            mustHaveDataForAllSelectedCountries
                        }
                        handleToggleRequireAllCountries={
                            handleToggleRequireAllCountries
                        }
                        countrySelections={countrySelections}
                        setCountrySelections={setCountrySelections}
                    />
                </div>
            </div>
            <TopicsRefinementList
                tagGraph={props.tagGraph}
                // addGlobalTagFilter={addGlobalTagFilter}
                // removeGlobalTagFilter={removeGlobalTagFilter}
            />
            {/* <DataCatalogResults
                tagGraph={props.tagGraph}
                addGlobalTagFilter={addGlobalTagFilter}
            /> */}
            {/* <DataCatalogLoadingSpinner /> */}
        </>
    )
}

function SetIndexUiStateTest() {
    const { setUiState } = useInstantSearch()
    const c = useConfigure({
        // index: CHARTS_INDEX,
    })

    return (
        <button
            className="span-cols-12 col-start-2"
            onClick={() => {
                c.refine({
                    facetFilters: [["tags:Energy"]],
                })
                // setUiState((prev) => {
                //     console.log("prev", prev)
                //     console.log("prev[CHARTS_INDEX]", prev[CHARTS_INDEX])
                //     return {
                //         ...prev,
                //         [CHARTS_INDEX]: {
                //             ...prev[CHARTS_INDEX],
                //             query: "new query",
                //         },
                //     }
                // })
            }}
        >
            Update query
        </button>
    )
}

// const routing: RouterProps<any, any> = {
//     router: history(),
//     // stateMapping: simple(),
//     stateMapping: {
//         stateToRoute(uiState) {
//             const chartsState = uiState[CHARTS_INDEX]
//             return {
//                 q: chartsState.query,
//                 topics: parseFacetFilters(chartsState.configure?.facetFilters)
//                     .topics,
//             }
//         },
//         routeToState(routeState) {
//             const facetFilters = [
//                 ...transformRouteTopicsToFacetFilters(routeState.topics),
//                 ...transformRouteCountriesToFacetFilters(routeState.countries),
//             ]
//             return {
//                 [CHARTS_INDEX]: {
//                     query: get(routeState, ["q"], "query was undefined"),
//                     configure: {
//                         facetFilters: facetFilters.length
//                             ? facetFilters
//                             : undefined,
//                     },
//                 },
//             }
//         },
//     },
// }

const CHARTS_INDEX = getIndexName(SearchIndexName.Charts)

export function DataCatalogInstantSearchWrapper({
    tagGraph,
}: {
    tagGraph: TagGraphRoot
}) {
    const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)

    return (
        <InstantSearch
            indexName={CHARTS_INDEX}
            searchClient={searchClient}
            onStateChange={({ uiState, setUiState }) => {
                console.log("state", uiState)
                setUiState(uiState)
            }}
            routing={{
                stateMapping: {
                    stateToRoute(uiState) {
                        console.log("calling stateToRoute")
                        console.log("uiState", uiState)
                        const chartIndexState = uiState[CHARTS_INDEX]
                        const q = chartIndexState.query
                        const facetFilters = parseFacetFilters(
                            chartIndexState.configure?.facetFilters
                        )
                        console.log("facetFilters", facetFilters)
                        const topics: string = facetFilters.topics.join(",")
                        console.log("topics", topics)
                        const countries = facetFilters.countries.join(",")
                        return {
                            q,
                            topics: topics.length ? topics : undefined,
                            countries: countries.length ? countries : undefined,
                            // requireAllCountries:
                            //     mustHaveDataForAllSelectedCountries
                            //         ? "true"
                            //         : undefined,
                        }
                    },
                    routeToState(routeState) {
                        console.log("calling routeToState")
                        console.log("routeState", routeState)
                        const facetFilters = [
                            ...transformRouteTopicsToFacetFilters(
                                routeState.topics
                            ),
                            ...transformRouteCountriesToFacetFilters(
                                routeState.countries
                            ),
                        ]
                        console.log("facetFilters", facetFilters)
                        return {
                            [CHARTS_INDEX]: {
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
            <SetIndexUiStateTest />
            <Index indexName={CHARTS_INDEX}>
                <DataCatalog tagGraph={tagGraph} />
            </Index>
        </InstantSearch>
    )
}

export function hydrateChartsPage() {
    const root = document.getElementById("charts-index-page-root")
    const tagGraph = window._OWID_TAG_GRAPH as TagGraphRoot
    if (root) {
        ReactDOM.hydrate(
            <DataCatalogInstantSearchWrapper tagGraph={tagGraph} />,
            root
        )
    }
}
