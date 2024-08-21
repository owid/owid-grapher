import React, { useEffect, useMemo, useReducer, useRef, useState } from "react"
import ReactDOM from "react-dom"
import cx from "classnames"
import {
    countriesByName,
    Country,
    get,
    isArray,
    Region,
    TagGraphNode,
    TagGraphRoot,
    Url,
    getPaginationPageNumbers,
} from "@ourworldindata/utils"
import algoliasearch, { SearchClient } from "algoliasearch"
import { ALGOLIA_ID, ALGOLIA_SEARCH_KEY } from "../settings/clientSettings.js"
import { IChartHit, SearchIndexName } from "./search/searchTypes.js"
import { getIndexName } from "./search/searchClient.js"
import { ChartHit } from "./search/ChartHit.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowLeft,
    faArrowRight,
    faClose,
    faGlobeAfrica,
    faGlobeAmericas,
    faGlobeAsia,
    faGlobeEurope,
    faMagnifyingGlass,
    faMapMarkerAlt,
} from "@fortawesome/free-solid-svg-icons"
import { LabeledSwitch } from "@ourworldindata/components"
import {
    useFocusTrap,
    useOffsetTop,
    useTriggerOnEscape,
    useTriggerWhenClickOutside,
} from "./hooks.js"
import { match } from "ts-pattern"
import { SearchResponse } from "instantsearch.js"

const DataCatalogSearchBox = ({
    value,
    setQuery,
}: {
    value: string
    setQuery: (query: string) => void
}) => {
    // Storing this in local state so that query params don't update during typing
    const [localValue, setLocalValue] = useState(value)

    return (
        <div className="data-catalog-search-box-container">
            <form
                className="data-catalog-search-form"
                onSubmit={(e) => {
                    e.preventDefault()
                    setQuery(localValue)
                }}
            >
                <input
                    type="text"
                    className="data-catalog-search-input body-3-regular"
                    placeholder="Search for an indicator, a topic, or a keyword &hellip;"
                    value={localValue}
                    onChange={(e) => {
                        setLocalValue(e.target.value)
                    }}
                />
            </form>
        </div>
    )
}

type DataCatalogState = Readonly<{
    query: string
    topics: Set<string>
    selectedCountryNames: Set<string>
    requireAllCountries: boolean
    page: number
}>

type AddTopicAction = {
    type: "addTopic"
    topic: string
}

type RemoveTopicAction = {
    type: "removeTopic"
    topic: string
}

type SetQueryAction = {
    type: "setQuery"
    query: string
}

type AddCountryAction = {
    type: "addCountry"
    country: string
}

type RemoveCountryAction = {
    type: "removeCountry"
    country: string
}

type ToggleRequireAllCountriesAction = {
    type: "toggleRequireAllCountries"
}

type ResetStateAction = {
    type: "resetState"
    state: DataCatalogState
}

type SetPageAction = {
    type: "setPage"
    page: number
}

type DataCatalogAction =
    | AddTopicAction
    | RemoveTopicAction
    | SetQueryAction
    | AddCountryAction
    | RemoveCountryAction
    | ToggleRequireAllCountriesAction
    | ResetStateAction
    | SetPageAction

const dataCatalogReducer = (
    state: DataCatalogState,
    action: DataCatalogAction
): DataCatalogState => {
    return match(action)
        .with({ type: "setQuery" }, ({ query }) => ({
            ...state,
            query,
        }))
        .with({ type: "addTopic" }, ({ topic }) => ({
            ...state,
            topics: new Set(state.topics).add(topic),
        }))
        .with({ type: "removeTopic" }, ({ topic }) => {
            const newTopics = new Set(state.topics)
            newTopics.delete(topic)
            return {
                ...state,
                topics: newTopics,
            }
        })
        .with({ type: "addCountry" }, ({ country }) => ({
            ...state,
            selectedCountryNames: new Set(state.selectedCountryNames).add(
                country
            ),
        }))
        .with({ type: "removeCountry" }, ({ country }) => {
            const newCountries = new Set(state.selectedCountryNames)
            newCountries.delete(country)
            return {
                ...state,
                selectedCountryNames: newCountries,
            }
        })
        .with({ type: "toggleRequireAllCountries" }, () => ({
            ...state,
            requireAllCountries: !state.requireAllCountries,
        }))
        .with({ type: "setPage" }, ({ page }) => ({
            ...state,
            page,
        }))
        .with({ type: "resetState" }, ({ state }) => state)
        .exhaustive()
}

function DataCatalogCountrySelector({
    countrySelections,
    requireAllCountries,
    addCountry,
    removeCountry,
    toggleRequireAllCountries,
}: {
    countrySelections: Set<string>
    requireAllCountries: boolean
    addCountry: (country: string) => void
    removeCountry: (country: string) => void
    toggleRequireAllCountries: () => void
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
    const toggleCountry = (country: string) => {
        if (countrySelections.has(country)) {
            removeCountry(country)
        } else {
            addCountry(country)
        }
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
                            aria-label="Close country selector"
                            className="data-catalog-country-selector-close-button"
                            onClick={() => setIsOpen(false)}
                        >
                            <FontAwesomeIcon icon={faClose} />
                        </button>
                    </div>
                    <LabeledSwitch
                        className="data-catalog-country-selector-switch"
                        value={requireAllCountries}
                        onToggle={toggleRequireAllCountries}
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
                                            toggleCountry(country.name)
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
    selectedCountryNames,
    removeCountry,
}: {
    selectedCountryNames: Set<string>
    removeCountry: (country: string) => void
}) => {
    if (selectedCountryNames.size === 0) return null
    return (
        <div className="data-catalog-selected-countries-container">
            {[...selectedCountryNames].map((country) => (
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
                        aria-label={`Remove ${country}`}
                        onClick={() => {
                            removeCountry(country)
                        }}
                    >
                        <FontAwesomeIcon icon={faClose} />
                    </button>
                </div>
            ))}
        </div>
    )
}

function checkIfNoTopicsOrOneAreaTopicApplied(
    topics: Set<string>,
    areas: string[]
) {
    if (topics.size === 0) return true
    if (topics.size > 1) return false

    const [tag] = topics.values()
    return areas.includes(tag)
}

function checkShouldShowRibbonView(
    query: string,
    topics: Set<string>,
    areaNames: string[]
): boolean {
    return (
        query === "" && checkIfNoTopicsOrOneAreaTopicApplied(topics, areaNames)
    )
}

type FacetFilters = string | undefined | readonly (string | readonly string[])[]

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

// function getNbHitsForTag(tag: string, results: ScopedResult[]) {
//     const result = results.find((r) => {
//         // for some reason I can only find facetFilters in the internal _state object
//         const facets = parseFacetFilters(
//             get(r, ["results", "_state", "facetFilters"])
//         )
//         return facets.topics.includes(tag)
//     })
//     return result ? result.results.nbHits : undefined
// }

const DataCatalogRibbon = ({
    tagName,
    addTopic,
    selectedCountries,
}: {
    tagName: string
    addTopic: (x: string) => void
    selectedCountries: Region[]
}) => {
    // const nBHits = getNbHitsForTag(tagName, scopedResults)

    // if (nBHits === 0) {
    //     return null
    // }

    return (
        <div>ribbon</div>
        // <Index indexName={CHARTS_INDEX}>
        //     <Configure facetFilters={[`tags:${tagName}`]} />
        //     <div className="data-catalog-ribbon">
        //         <a
        //             // TODO: update this with the rest of the query params
        //             href={`/charts?topics=${tagName}`}
        //             onClick={(e) => {
        //                 e.preventDefault()
        //                 addTopic(tagName)
        //             }}
        //         >
        //             <div className="data-catalog-ribbon__header">
        //                 <h2 className="body-1-regular">{tagName}</h2>
        //                 <span className="data-catalog-ribbon__hit-count body-2-semibold">
        //                     {nBHits} indicators
        //                     <FontAwesomeIcon icon={faArrowRight} />
        //                 </span>
        //             </div>
        //         </a>
        //         <Hits
        //             classNames={{
        //                 root: "data-catalog-ribbon-hits",
        //                 item: "data-catalog-ribbon-hit",
        //                 list: "data-catalog-ribbon-list grid grid-cols-4",
        //             }}
        //             hitComponent={({ hit }: { hit: IChartHit }) => (
        //                 <ChartHit
        //                     hit={hit}
        //                     searchQueryRegionsMatches={selectedCountries}
        //                 />
        //             )}
        //         />
        //     </div>
        // </Index>
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

function getCountryData(selectedCountries: Set<string>): Region[] {
    const regionData: Region[] = []
    const countries = countriesByName()
    for (const selectedCountry of selectedCountries) {
        regionData.push(countries[selectedCountry])
    }
    return regionData
}

const DataCatalogRibbonView = ({
    tagGraph,
    tagToShow,
    addTopic,
    selectedCountries,
}: {
    tagGraph: TagGraphRoot
    tagToShow: string | undefined
    addTopic: (x: string) => void
    selectedCountries: Region[]
}) => {
    const areas = getAreaChildrenFromTag(tagGraph, tagToShow)

    return (
        <div className="span-cols-12 col-start-2 data-catalog-ribbons">
            {areas.map((area) => (
                <DataCatalogRibbon
                    tagName={area.name}
                    key={area.name}
                    addTopic={addTopic}
                    selectedCountries={selectedCountries}
                />
            ))}
        </div>
    )
}

const DataCatalogResults = ({
    shouldShowRibbons,
    topics,
    tagGraph,
    addTopic,
    selectedCountryNames,
    results,
}: {
    tagGraph: TagGraphRoot
    results?: DataCatalogResults
    addTopic: (tag: string) => void
    shouldShowRibbons: boolean
    topics: Set<string>
    selectedCountryNames: Set<string>
}) => {
    return (
        <div className="span-cols-12 col-start-2">
            <p>results:</p>
            {results?.map((result) => (
                <div key={result.title}>
                    {result.title}
                    <ul>
                        {result.hits.map((hit) => (
                            <li key={hit.slug}>{hit.title}</li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    )

    // const selectedCountries = getCountryData(selectedCountryNames)

    // if (shouldShowRibbons) {
    //     const areaName: string = topics.values().next().value
    //     return (
    //         <DataCatalogRibbonView
    //             tagGraph={tagGraph}
    //             tagToShow={areaName}
    //             addTopic={addTopic}
    //             selectedCountries={selectedCountries}
    //         />
    //     )
    // }

    return (
        <div>all results</div>
        // <Index indexName={CHARTS_INDEX}>
        //     <Hits
        //         classNames={{
        //             root: cx(
        //                 "span-cols-12 col-start-2 data-catalog-search-hits",
        //                 { "data-catalog-search-hits--is-loading": isLoading }
        //             ),
        //             item: "data-catalog-search-hit",
        //             list: "data-catalog-search-list grid grid-cols-4",
        //         }}
        //         hitComponent={(props: { hit: IChartHit }) => (
        //             <ChartHit
        //                 hit={props.hit}
        //                 searchQueryRegionsMatches={selectedCountries}
        //             />
        //         )}
        //     />
        // </Index>
    )
}

const TopicsRefinementList = (props: {
    shouldShowSuggestions: boolean
    topics: Set<string>
    addTopic: (topic: string) => void
    removeTopic: (topic: string) => void
    isLoading?: boolean
}) => {
    // const refinements = useRefinementList({
    //     attribute: "tags",
    //     limit: 10,
    // })
    // const refinementsToShow = props.shouldShowSuggestions
    //     ? refinements.items.filter((item) => !props.topics.has(item.label))
    //     : []

    return <div>refinements list</div>
    // return (
    //     <>
    //         <ul className="data-catalog-applied-filters-list span-cols-12 col-start-2 ">
    //             {[...props.topics].map((topic) => {
    //                 return (
    //                     <li
    //                         className="data-catalog-applied-filters-item"
    //                         key={topic}
    //                     >
    //                         <button
    //                             aria-label={`Remove filter ${topic}`}
    //                             className="data-catalog-applied-filters-button body-3-medium"
    //                             onMouseUp={() => {
    //                                 setShouldHideFacets(true)
    //                             }}
    //                             onClick={() => props.removeTopic(topic)}
    //                         >
    //                             {topic}
    //                             <FontAwesomeIcon icon={faClose} />
    //                         </button>
    //                     </li>
    //                 )
    //             })}
    //         </ul>
    //         <ul
    //             className={cx(
    //                 "data-catalog-filters-list span-cols-12 col-start-2",
    //                 {
    //                     "data-catalog-filters-list--is-loading":
    //                         props.isLoading || shouldHideFacets,
    //                 }
    //             )}
    //         >
    //             {refinementsToShow.map((item, i) => {
    //                 const isLast = i === refinementsToShow.length - 1
    //                 return (
    //                     <React.Fragment key={i}>
    //                         <li className="data-catalog-filters-list-item">
    //                             <button
    //                                 aria-label={`Filter by ${item.label}`}
    //                                 onMouseUp={() => setShouldHideFacets(true)}
    //                                 onClick={() => props.addTopic(item.label)}
    //                             >
    //                                 <span>{item.label}</span>
    //                                 <span className="data-catalog-filters-list-item__hit-count body-3-medium">
    //                                     ({item.count})
    //                                 </span>
    //                             </button>
    //                         </li>
    //                         {!isLast ? (
    //                             <li className="data-catalog-filters-list-separator">
    //                                 {/* including an empty space so that the list has spaces in it when copied to clipboard */}{" "}
    //                             </li>
    //                         ) : null}
    //                     </React.Fragment>
    //                 )
    //             })}
    //         </ul>
    //     </>
    // )
}

const DataCatalogLoadingSpinner = () => {
    const icons = [faGlobeEurope, faGlobeAmericas, faGlobeAsia, faGlobeAfrica]
    const spinnerRef = useRef<HTMLDivElement>(null)
    const offsetTop = useOffsetTop(spinnerRef)
    return (
        <div
            style={{ minHeight: `calc(100vh - ${offsetTop}px)` }}
            ref={spinnerRef}
            className={cx("data-catalog-loading-spinner span-cols-14")}
        >
            {icons.map((icon) => (
                <FontAwesomeIcon
                    key={icon.iconName}
                    icon={icon}
                    className="data-catalog-loading-spinner__globe"
                />
            ))}
        </div>
    )
}

const DataCatalogPagination = ({
    isLoading,
    setPage,
    isOnRibbonsView,
}: {
    isLoading: boolean
    setPage: (page: number) => void
    isOnRibbonsView: boolean
}) => {
    // TODO
    const nbPages: number = 10
    const currentRefinement = 0
    const pages = getPaginationPageNumbers(currentRefinement, nbPages)

    useEffect(() => {
        if (currentRefinement !== 0) {
            if (isOnRibbonsView || currentRefinement >= nbPages) {
                setPage(0)
            }
        }
    }, [isOnRibbonsView, currentRefinement, nbPages, setPage])

    if (isOnRibbonsView || nbPages === 0) return null

    return (
        <ol
            className={cx({
                "data-catalog-pagination span-cols-12 col-start-2": true,
                "data-catalog-pagination--is-loading": isLoading,
            })}
        >
            <li className="data-catalog-pagination__item">
                <button
                    onClick={() => setPage(currentRefinement - 1)}
                    disabled={currentRefinement === 0}
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                </button>
            </li>
            {pages.map((page) => (
                <li
                    key={page}
                    className={cx({
                        "data-catalog-pagination__item": true,
                        "data-catalog-pagination__item--is-active":
                            page === currentRefinement,
                    })}
                >
                    <button
                        onClick={() => setPage(page)}
                        disabled={page === currentRefinement}
                    >
                        {page + 1}
                    </button>
                </li>
            ))}
            <li className="data-catalog-pagination__item">
                <button
                    onClick={() => setPage(currentRefinement + 1)}
                    disabled={currentRefinement === nbPages - 1}
                >
                    <FontAwesomeIcon icon={faArrowRight} />
                </button>
            </li>
        </ol>
    )
}

const serializeSet = (set: Set<string>) =>
    set.size ? [...set].join(",") : undefined

const deserializeSet = (str?: string): Set<string> =>
    str ? new Set(str.split(",")) : new Set()

function dataCatalogStateToUrl(state: DataCatalogState) {
    let url = Url.fromURL(
        typeof window === "undefined" ? "" : window.location.href
    )

    const params = {
        q: state.query || undefined,
        topics: serializeSet(state.topics),
        countries: serializeSet(state.selectedCountryNames),
        requireAllCountries: state.requireAllCountries ? "true" : undefined,
        page: state.page > 0 ? (state.page + 1).toString() : undefined,
    }

    Object.entries(params).forEach(([key, value]) => {
        url = url.updateQueryParams({ [key]: value })
    })

    return url.fullUrl
}

type DataCatalogResults = Array<
    SearchResponse<DataCatalogHit> & {
        title: string
    }
>
type DataCatalogCache = Map<string, DataCatalogResults>

export const DataCatalog = ({
    initialState,
    tagGraph,
    searchClient,
}: {
    initialState: DataCatalogState
    tagGraph: TagGraphRoot
    searchClient: SearchClient
}) => {
    const [state, dispatch] = useReducer(dataCatalogReducer, initialState)

    const [isLoading, setIsLoading] = useState(false)
    const cache = useRef<DataCatalogCache>(new Map())
    const AREA_NAMES = useMemo(
        () => tagGraph.children.map((child) => child.name),
        [tagGraph]
    )
    const shouldShowRibbons = useMemo(
        () => checkShouldShowRibbonView(state.query, state.topics, AREA_NAMES),
        [state.query, state.topics, AREA_NAMES]
    )
    const topicsForRibbons = useMemo(
        () => getTopicsForRibbons(shouldShowRibbons, state.topics, tagGraph),
        [state.topics, tagGraph, shouldShowRibbons]
    )

    const stateAsUrl = dataCatalogStateToUrl(state)
    const currentResults = cache.current.get(stateAsUrl)
    console.log("currentResults", currentResults)
    useEffect(() => {
        syncDataCatalogURL(stateAsUrl)
        if (cache.current.has(stateAsUrl)) return
        setIsLoading(true)
        const searchParams = shouldShowRibbons
            ? dataCatalogStateToAlgoliaQueries(state, topicsForRibbons)
            : dataCatalogStateToAlgoliaQuery(state)
        searchClient
            .search<DataCatalogHit>(searchParams)
            .then((data) => {
                const formatted = formatAlgoliaResponse(data, topicsForRibbons)
                cache.current.set(stateAsUrl, formatted)
            })
            .catch((e) => {
                console.error(e)
                // TODO: handle error
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [
        state,
        searchClient,
        shouldShowRibbons,
        tagGraph,
        stateAsUrl,
        topicsForRibbons,
    ])

    useEffect(() => {
        const handlePopState = () => {
            const url = Url.fromURL(window.location.href)
            dispatch({ type: "resetState", state: urlToDataCatalogState(url) })
        }
        window.addEventListener("popstate", handlePopState)
        return () => {
            window.removeEventListener("popstate", handlePopState)
        }
    }, [])

    return (
        <>
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
                    <div className="data-catalog-pseudoform">
                        <SelectedCountriesPills
                            selectedCountryNames={state.selectedCountryNames}
                            removeCountry={(country: string) =>
                                dispatch({ type: "removeCountry", country })
                            }
                        />
                        <DataCatalogSearchBox
                            value={state.query}
                            setQuery={(query: string) =>
                                dispatch({ type: "setQuery", query })
                            }
                        />
                    </div>
                    <DataCatalogCountrySelector
                        requireAllCountries={state.requireAllCountries}
                        toggleRequireAllCountries={() =>
                            dispatch({ type: "toggleRequireAllCountries" })
                        }
                        countrySelections={state.selectedCountryNames}
                        addCountry={(country: string) =>
                            dispatch({ type: "addCountry", country })
                        }
                        removeCountry={(country: string) =>
                            dispatch({ type: "removeCountry", country })
                        }
                    />
                </div>
            </div>
            {/* <TopicsRefinementList
                shouldShowSuggestions={!shouldShowRibbons}
                isLoading={isLoading}
                topics={state.topics}
                addTopic={(topic: string) =>
                    dispatch({ type: "addTopic", topic })
                }
                removeTopic={(topic: string) =>
                    dispatch({ type: "removeTopic", topic })
                }
            /> */}
            {isLoading ? (
                <DataCatalogLoadingSpinner />
            ) : (
                <>
                    <DataCatalogResults
                        results={currentResults}
                        shouldShowRibbons={shouldShowRibbons}
                        topics={state.topics}
                        tagGraph={tagGraph}
                        addTopic={(topic: string) =>
                            dispatch({ type: "addTopic", topic })
                        }
                        selectedCountryNames={state.selectedCountryNames}
                    />
                    {/* <DataCatalogPagination
                        isLoading={isLoading}
                        isOnRibbonsView={shouldShowRibbons}
                        setPage={(page: number) =>
                            dispatch({
                                type: "setPage",
                                page,
                            })
                        }
                    /> */}
                </>
            )}
        </>
    )
}

const CHARTS_INDEX = getIndexName(SearchIndexName.Charts)

type DataCatalogHit = {
    title: string
    slug: string
}

function formatAlgoliaResponse(
    response: any,
    ribbonTopics: string[]
): DataCatalogResults {
    if (!response.results) return []
    // this was a ribbon search
    if (ribbonTopics.length) {
        return response.results.map(
            (res: SearchResponse<DataCatalogHit>, i: number) => ({
                ...res,
                title: ribbonTopics[i],
            })
        )
    } else {
        return response.results.map((res: SearchResponse<DataCatalogHit>) => ({
            ...res,
            title: "All results",
        }))
    }
}

// set url if it's different from the current url.
// when the user navigates back, we derive the state from the url and set it
// so the url is already identical to the state - we don't need to push it again (otherwise we'd get an infinite loop)
function syncDataCatalogURL(stateAsUrl: string) {
    const currentUrl = window.location.href
    if (currentUrl !== stateAsUrl) {
        window.history.pushState({}, "", stateAsUrl)
    }
    setTimeout(() => {
        window.scrollTo({ behavior: "smooth", top: 0 })
    }, 100)
}

function setToFacetFilters(
    facetSet: Set<string>,
    attribute: "tags" | "availableEntities"
) {
    return Array.from(facetSet).map((facet) => [`${attribute}:${facet}`])
}

function getTopicsForRibbons(
    shouldShowRibbons: boolean,
    topics: Set<string>,
    tagGraph: TagGraphRoot
) {
    if (!shouldShowRibbons) return []
    if (topics.size === 0) return tagGraph.children.map((child) => child.name)
    if (topics.size === 1) {
        const area = tagGraph.children.find((child) => topics.has(child.name))
        if (area) return area.children.map((child) => child.name)
    }
    return []
}

function dataCatalogStateToAlgoliaQueries(
    state: DataCatalogState,
    topicNames: string[]
) {
    return topicNames.map((topic) => ({
        indexName: CHARTS_INDEX,
        query: state.query,
        facetFilters: [
            [`tags:${topic}`],
            ...setToFacetFilters(
                state.selectedCountryNames,
                "availableEntities"
            ),
        ],
        attributesToRetrieve: ["title", "slug"],
        hitsPerPage: 4,
        page: state.page,
    }))
}

function dataCatalogStateToAlgoliaQuery(state: DataCatalogState) {
    return [
        {
            indexName: CHARTS_INDEX,
            query: state.query,
            facetFilters: [
                ...setToFacetFilters(state.topics, "tags"),
                ...setToFacetFilters(
                    state.selectedCountryNames,
                    "availableEntities"
                ),
            ],
            attributesToRetrieve: ["title", "slug"],
            facets: ["tags"],
            hitsPerPage: 20,
            page: state.page,
        },
    ]
}

function urlToDataCatalogState(url: Url): DataCatalogState {
    return {
        query: url.queryParams.q || "",
        topics: deserializeSet(url.queryParams.topics),
        selectedCountryNames: deserializeSet(url.queryParams.countries),
        requireAllCountries: url.queryParams.requireAllCountries === "true",
        page: url.queryParams.page ? parseInt(url.queryParams.page) - 1 : 0,
    }
}

function getInitialDatacatalogState(): DataCatalogState {
    if (typeof window === "undefined")
        return {
            query: "",
            topics: new Set(),
            selectedCountryNames: new Set(),
            requireAllCountries: false,
            page: 0,
        }

    const url = Url.fromURL(window.location.href)
    return urlToDataCatalogState(url)
}

export function DataCatalogInstantSearchWrapper({
    tagGraph,
}: {
    tagGraph: TagGraphRoot
}) {
    const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)

    const initialState = getInitialDatacatalogState()

    return (
        <DataCatalog
            initialState={initialState}
            tagGraph={tagGraph}
            searchClient={searchClient}
        />
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
