import React, { useEffect, useMemo, useReducer, useRef, useState } from "react"
import ReactDOM from "react-dom"
import cx from "classnames"
import {
    countriesByName,
    Country,
    debounce,
    TagGraphRoot,
    Url,
} from "@ourworldindata/utils"
import {
    Hits,
    InstantSearch,
    useConfigure,
    useInstantSearch,
    useSearchBox,
} from "react-instantsearch"
import algoliasearch from "algoliasearch"
import { ALGOLIA_ID, ALGOLIA_SEARCH_KEY } from "../settings/clientSettings.js"
import { SearchIndexName } from "./search/searchTypes.js"
import { getIndexName } from "./search/searchClient.js"
import { ChartHit } from "./search/ChartHit.js"
import { UiState } from "instantsearch.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faClose,
    faMagnifyingGlass,
    faMapMarkerAlt,
} from "@fortawesome/free-solid-svg-icons"
import { LabeledSwitch } from "@ourworldindata/components"
import {
    useFocusTrap,
    useTriggerOnEscape,
    useTriggerWhenClickOutside,
} from "./hooks.js"

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
    countries: Set<string>
    requireAllCountries: boolean
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

type DataCatalogAction =
    | AddTopicAction
    | RemoveTopicAction
    | SetQueryAction
    | AddCountryAction
    | RemoveCountryAction
    | ToggleRequireAllCountriesAction

const dataCatalogReducer = (
    state: DataCatalogState,
    action: DataCatalogAction
) => {
    switch (action.type) {
        case "setQuery":
            return { ...state, query: action.query }
        case "addTopic":
            return {
                ...state,
                topics: new Set(state.topics).add(action.topic),
            }
        case "removeTopic":
            const newTopics = new Set(state.topics)
            newTopics.delete(action.topic)
            return {
                ...state,
                topics: newTopics,
            }
        case "addCountry":
            return {
                ...state,
                countries: new Set(state.countries).add(action.country),
            }
        case "removeCountry":
            const newCountries = new Set(state.countries)
            newCountries.delete(action.country)
            return {
                ...state,
                countries: newCountries,
            }
        case "toggleRequireAllCountries":
            return {
                ...state,
                requireAllCountries: !state.requireAllCountries,
            }
        default:
            return state
    }
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
    countrySelections,
    removeCountry,
}: {
    countrySelections: Set<string>
    removeCountry: (country: string) => void
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

// const DataCatalogResults = ({
//     tagGraph,
//     addGlobalTagFilter,
// }: {
//     tagGraph: TagGraphRoot
//     addGlobalTagFilter: (tag: string) => void
// }) => {
//     const { uiState, status } = useInstantSearch()
//     const genericState = uiState[""]
//     const query = genericState.query
//     const countrySelections = getRegionsFromSelectedEntitiesFacets(
//         genericState.configure?.facetFilters
//     )
//     const facetFilters = parseFacetFilters(genericState.configure?.facetFilters)
//     const areaNames = tagGraph.children.map((child) => child.name)
//     const isLoading = status === "loading" || status === "stalled"
//     const shouldShowRibbons = checkShouldShowRibbonView(
//         query,
//         facetFilters.topics,
//         areaNames
//     )

//     if (shouldShowRibbons)
//         return (
//             <DataCatalogRibbonView
//                 isLoading={isLoading}
//                 tagGraph={tagGraph}
//                 tagToShow={facetFilters.topics[0]}
//                 addGlobalTagFilter={addGlobalTagFilter}
//             />
//         )

//     return (
//         <Index indexName={CHARTS_INDEX}>
//             <Hits
//                 classNames={{
//                     root: cx(
//                         "data-catalog-search-hits span-cols-12 col-start-2",
//                         {
//                             "data-catalog-search-hits--is-loading": isLoading,
//                         }
//                     ),
//                     item: "data-catalog-search-hit",
//                     list: "data-catalog-search-list grid grid-cols-4",
//                 }}
//                 hitComponent={({ hit }: any) => (
//                     <ChartHit
//                         hit={hit}
//                         searchQueryRegionsMatches={countrySelections}
//                     />
//                 )}
//             />
//         </Index>
//     )
// }

function dataCatalogStateToQueryParams(state: DataCatalogState) {
    let url = Url.fromURL(window.location.href)
    const serializeSet = (set: Set<string>) =>
        set.size ? [...set].join(",") : undefined

    const params = {
        q: state.query || undefined,
        topics: serializeSet(state.topics),
        countries: serializeSet(state.countries),
        requireAllCountries: state.requireAllCountries ? "true" : undefined,
    }

    Object.entries(params).forEach(([key, value]) => {
        url = url.updateQueryParams({ [key]: value })
    })

    return url.fullUrl
}

export const DataCatalog = (props: {
    initialState: DataCatalogState
    tagGraph: TagGraphRoot
}) => {
    const [state, dispatch] = useReducer(dataCatalogReducer, props.initialState)
    const { setUiState } = useInstantSearch()
    const stableSetUiState = useMemo(() => setUiState, [setUiState])
    // necessary to call these so that calls to setUiState that set query and configure are listened to
    const _ = useSearchBox()
    const __ = useConfigure({})

    const debouncedIO = useMemo(() => {
        return debounce((query, topics, countries, requireAllCountries) => {
            console.log("searching for", query)
            console.log("topics", topics)
            stableSetUiState(
                dataCatalogStateToUiState({
                    query,
                    topics,
                    countries,
                    requireAllCountries,
                })
            )

            // set query params
            const newUrl = dataCatalogStateToQueryParams({
                query,
                topics,
                countries,
                requireAllCountries,
            })
            window.history.pushState({}, "", newUrl)
        }, 50)
    }, [stableSetUiState])

    useEffect(() => {
        debouncedIO(
            state.query,
            state.topics,
            state.countries,
            state.requireAllCountries
        )
        return () => {
            debouncedIO.cancel()
        }
    }, [
        state.query,
        state.topics,
        state.countries,
        state.requireAllCountries,
        debouncedIO,
    ])

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
                            countrySelections={state.countries}
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
                        countrySelections={state.countries}
                        addCountry={(country: string) =>
                            dispatch({ type: "addCountry", country })
                        }
                        removeCountry={(country: string) =>
                            dispatch({ type: "removeCountry", country })
                        }
                    />
                </div>
            </div>
            <div className="grid">
                <Hits
                    classNames={{
                        root: "grid span-cols-12",
                        list: "grid span-cols-12 list-style-none",
                        item: "span-cols-4",
                    }}
                    hitComponent={ChartHit}
                />
            </div>
        </>
    )
}

const CHARTS_INDEX = getIndexName(SearchIndexName.Charts)

function setToFacetFilters(
    facetSet: Set<string>,
    attribute: "tags" | "availableEntities"
) {
    return Array.from(facetSet).map((facet) => [`${attribute}:${facet}`])
}

function dataCatalogStateToUiState(state: DataCatalogState): UiState {
    return {
        [CHARTS_INDEX]: {
            query: state.query,
            configure: {
                facetFilters: [
                    ...setToFacetFilters(state.topics, "tags"),
                    ...setToFacetFilters(state.countries, "availableEntities"),
                ],
            },
        },
    }
}

function getInitialDatacatalogState(): DataCatalogState {
    if (typeof window === "undefined")
        return {
            query: "",
            topics: new Set(),
            countries: new Set(),
            requireAllCountries: false,
        }

    const url = Url.fromURL(window.location.href)
    return {
        query: url.queryParams.q || "",
        topics: new Set(url.queryParams.topics?.split(",") || []),
        countries: new Set(url.queryParams.countries?.split(",") || []),
        requireAllCountries: url.queryParams.requireAllCountries === "true",
    }
}

export function DataCatalogInstantSearchWrapper({
    tagGraph,
}: {
    tagGraph: TagGraphRoot
}) {
    const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    const initialState = getInitialDatacatalogState()

    return (
        <InstantSearch
            indexName={CHARTS_INDEX}
            searchClient={searchClient}
            // Even though we end up managing the state inside the DataCatalog, we need to initialize it here
            // so that we don't run a blank search on mount
            initialUiState={dataCatalogStateToUiState(initialState)}
        >
            <DataCatalog initialState={initialState} tagGraph={tagGraph} />
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
