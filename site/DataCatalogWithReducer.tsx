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
} from "@ourworldindata/utils"
import {
    Configure,
    Hits,
    Index,
    InstantSearch,
    useConfigure,
    useInstantSearch,
    useRefinementList,
    useSearchBox,
} from "react-instantsearch"
import algoliasearch from "algoliasearch"
import { ALGOLIA_ID, ALGOLIA_SEARCH_KEY } from "../settings/clientSettings.js"
import { IChartHit, SearchIndexName } from "./search/searchTypes.js"
import { getIndexName } from "./search/searchClient.js"
import { ChartHit } from "./search/ChartHit.js"
import { ScopedResult, UiState } from "instantsearch.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
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

type DataCatalogAction =
    | AddTopicAction
    | RemoveTopicAction
    | SetQueryAction
    | AddCountryAction
    | RemoveCountryAction
    | ToggleRequireAllCountriesAction
    | ResetStateAction

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
    state: DataCatalogState,
    areaNames: string[]
): boolean {
    return (
        state.query === "" &&
        checkIfNoTopicsOrOneAreaTopicApplied(state.topics, areaNames)
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

function getNbHitsForTag(tag: string, results: ScopedResult[]) {
    const result = results.find((r) => {
        // for some reason I can only find facetFilters in the internal _state object
        const facets = parseFacetFilters(
            get(r, ["results", "_state", "facetFilters"])
        )
        return facets.topics.includes(tag)
    })
    return result ? result.results.nbHits : undefined
}

const DataCatalogRibbon = ({
    tagName,
    addTopic,
    selectedCountries,
}: {
    tagName: string
    addTopic: (x: string) => void
    selectedCountries: Region[]
}) => {
    const { scopedResults } = useInstantSearch()
    const nBHits = getNbHitsForTag(tagName, scopedResults)

    if (nBHits === 0) {
        return null
    }

    return (
        <Index indexName={CHARTS_INDEX}>
            <Configure facetFilters={[`tags:${tagName}`]} />
            <div className="data-catalog-ribbon">
                <a
                    // TODO: update this with the rest of the query params
                    href={`/charts?topics=${tagName}`}
                    onClick={(e) => {
                        e.preventDefault()
                        addTopic(tagName)
                        setTimeout(() => {
                            window.scrollTo({ behavior: "smooth", top: 0 })
                        }, 100)
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
                    hitComponent={({ hit }: { hit: IChartHit }) => (
                        <ChartHit
                            hit={hit}
                            searchQueryRegionsMatches={selectedCountries}
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
    isLoading,
    selectedCountries,
}: {
    tagGraph: TagGraphRoot
    tagToShow: string | undefined
    addTopic: (x: string) => void
    isLoading: boolean
    selectedCountries: Region[]
}) => {
    const areas = getAreaChildrenFromTag(tagGraph, tagToShow)
    // For some reason, setting this in the DataCatalogRibbon Configure component doesn't work
    const __ = useConfigure({
        hitsPerPage: 4,
    })

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
    isLoading,
}: {
    tagGraph: TagGraphRoot
    addTopic: (tag: string) => void
    shouldShowRibbons: boolean
    topics: Set<string>
    selectedCountryNames: Set<string>
    isLoading: boolean
}) => {
    const selectedCountries = getCountryData(selectedCountryNames)

    if (shouldShowRibbons) {
        const areaName: string = topics.values().next().value
        return (
            <DataCatalogRibbonView
                tagGraph={tagGraph}
                tagToShow={areaName}
                addTopic={addTopic}
                isLoading={isLoading}
                selectedCountries={selectedCountries}
            />
        )
    }

    return (
        <Index indexName={CHARTS_INDEX}>
            <Hits
                classNames={{
                    root: cx(
                        "span-cols-12 col-start-2 data-catalog-search-hits",
                        { "data-catalog-search-hits--is-loading": isLoading }
                    ),
                    item: "data-catalog-search-hit",
                    list: "data-catalog-search-list grid grid-cols-4",
                }}
                hitComponent={(props: { hit: IChartHit }) => (
                    <ChartHit
                        hit={props.hit}
                        searchQueryRegionsMatches={selectedCountries}
                    />
                )}
            />
        </Index>
    )
}

const TopicsRefinementList = (props: {
    shouldShowSuggestions: boolean
    topics: Set<string>
    addTopic: (topic: string) => void
    removeTopic: (topic: string) => void
    isLoading?: boolean
}) => {
    const refinements = useRefinementList({
        attribute: "tags",
        limit: 10,
    })
    const refinementsToShow = props.shouldShowSuggestions
        ? refinements.items.filter((item) => !props.topics.has(item.label))
        : []

    // Immediately hide the facets once the button is clicked, because otherwise they get updated with erroneous facets before isLoading kicks in
    // See (https://github.com/algolia/instantsearch/issues/6323)
    const [shouldHideFacets, setShouldHideFacets] = useState(props.isLoading)
    useEffect(() => {
        setTimeout(() => {
            if (shouldHideFacets) setShouldHideFacets(false)
        }, 100)
    }, [shouldHideFacets])

    return (
        <>
            <ul className="data-catalog-applied-filters-list span-cols-12 col-start-2 ">
                {[...props.topics].map((topic) => {
                    return (
                        <li
                            className="data-catalog-applied-filters-item"
                            key={topic}
                        >
                            <button
                                aria-label={`Remove filter ${topic}`}
                                className="data-catalog-applied-filters-button body-3-medium"
                                onMouseUp={() => {
                                    setShouldHideFacets(true)
                                }}
                                onClick={() => props.removeTopic(topic)}
                            >
                                {topic}
                                <FontAwesomeIcon icon={faClose} />
                            </button>
                        </li>
                    )
                })}
            </ul>
            <ul
                className={cx(
                    "data-catalog-filters-list span-cols-12 col-start-2",
                    {
                        "data-catalog-filters-list--is-loading":
                            props.isLoading || shouldHideFacets,
                    }
                )}
            >
                {refinementsToShow.map((item, i) => {
                    const isLast = i === refinementsToShow.length - 1
                    return (
                        <React.Fragment key={i}>
                            <li className="data-catalog-filters-list-item">
                                <button
                                    aria-label={`Filter by ${item.label}`}
                                    onMouseUp={() => setShouldHideFacets(true)}
                                    onClick={() => props.addTopic(item.label)}
                                >
                                    <span>{item.label}</span>
                                    <span className="data-catalog-filters-list-item__hit-count body-3-medium">
                                        ({item.count})
                                    </span>
                                </button>
                            </li>
                            {!isLast ? (
                                <li className="data-catalog-filters-list-separator">
                                    {/* including an empty space so that the list has spaces in it when copied to clipboard */}{" "}
                                </li>
                            ) : null}
                        </React.Fragment>
                    )
                })}
            </ul>
        </>
    )
}

const DataCatalogLoadingSpinner = ({ isLoading }: { isLoading: boolean }) => {
    const icons = [faGlobeEurope, faGlobeAmericas, faGlobeAsia, faGlobeAfrica]
    const spinnerRef = useRef<HTMLDivElement>(null)
    const offsetTop = useOffsetTop(spinnerRef)
    return (
        <div
            style={{ minHeight: `calc(100vh - ${offsetTop}px)` }}
            ref={spinnerRef}
            className={cx("data-catalog-loading-spinner span-cols-14", {
                "data-catalog-loading-spinner--is-loading": isLoading,
            })}
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

const serializeSet = (set: Set<string>) =>
    set.size ? [...set].join(",") : undefined

const deserializeSet = (str?: string): Set<string> =>
    str ? new Set(str.split(",")) : new Set()

function dataCatalogStateToUrl(state: DataCatalogState) {
    let url = Url.fromURL(window.location.href)

    const params = {
        q: state.query || undefined,
        topics: serializeSet(state.topics),
        countries: serializeSet(state.selectedCountryNames),
        requireAllCountries: state.requireAllCountries ? "true" : undefined,
    }

    Object.entries(params).forEach(([key, value]) => {
        url = url.updateQueryParams({ [key]: value })
    })

    return url.fullUrl
}

// Due to https://github.com/algolia/instantsearch/issues/6323, 2 queries are fired in quick succession when a new search is submitted.
// This race condition causes status to flicker between "idle" and "loading".
// To prevent this, this hook delays updating the isLoading state back to false, so that isLoading stays true even when the first query has finished.
// Once the issue is fixed, we should remove this logic so that the correct results are shown immediately.
function useDelayedIsLoading() {
    const { status } = useInstantSearch()
    const isLoading = status === "loading" || status === "stalled"
    const [delayedIsLoading, setDelayedIsLoading] = useState(isLoading)

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>
        if (isLoading) {
            setDelayedIsLoading(true)
        } else if (delayedIsLoading) {
            timeout = setTimeout(() => {
                setDelayedIsLoading(false)
            }, 400)
        }

        return () => clearTimeout(timeout)
    }, [isLoading, delayedIsLoading])

    return delayedIsLoading
}

export const DataCatalog = (props: {
    initialState: DataCatalogState
    tagGraph: TagGraphRoot
}) => {
    // necessary to call these so that calls to setUiState that set query and configure are listened to
    const _ = useSearchBox()
    const __ = useConfigure({})

    const [state, dispatch] = useReducer(dataCatalogReducer, props.initialState)
    const { setUiState } = useInstantSearch()
    const stableSetUiState = useMemo(() => setUiState, [setUiState])
    const delayedIsLoading = useDelayedIsLoading()

    const areaNames = props.tagGraph.children.map((child) => child.name)
    const shouldShowRibbons = checkShouldShowRibbonView(state, areaNames)

    useEffect(() => {
        // set instantsearch state
        stableSetUiState(dataCatalogStateToUiState(state))
        // set url if it's different from the current url.
        // when the user navigates back, we derive the state from the url and set it
        // so the url is already identical to the state - we don't need to push it again (otherwise we'd get an infinite loop)
        const currentUrl = window.location.href
        const stateAsUrl = dataCatalogStateToUrl(state)
        if (currentUrl !== stateAsUrl) {
            window.history.pushState({}, "", dataCatalogStateToUrl(state))
        }
    }, [state, stableSetUiState])

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
            <TopicsRefinementList
                shouldShowSuggestions={!shouldShowRibbons}
                isLoading={delayedIsLoading}
                topics={state.topics}
                addTopic={(topic: string) =>
                    dispatch({ type: "addTopic", topic })
                }
                removeTopic={(topic: string) =>
                    dispatch({ type: "removeTopic", topic })
                }
            />
            <DataCatalogResults
                shouldShowRibbons={shouldShowRibbons}
                isLoading={delayedIsLoading}
                topics={state.topics}
                tagGraph={props.tagGraph}
                addTopic={(topic: string) =>
                    dispatch({ type: "addTopic", topic })
                }
                selectedCountryNames={state.selectedCountryNames}
            />
            <DataCatalogLoadingSpinner isLoading={delayedIsLoading} />
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
                    ...setToFacetFilters(
                        state.selectedCountryNames,
                        "availableEntities"
                    ),
                ],
            },
        },
    }
}

function urlToDataCatalogState(url: Url): DataCatalogState {
    return {
        query: url.queryParams.q || "",
        topics: deserializeSet(url.queryParams.topics),
        selectedCountryNames: deserializeSet(url.queryParams.countries),
        requireAllCountries: url.queryParams.requireAllCountries === "true",
    }
}

function getInitialDatacatalogState(): DataCatalogState {
    if (typeof window === "undefined")
        return {
            query: "",
            topics: new Set(),
            selectedCountryNames: new Set(),
            requireAllCountries: false,
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
        <InstantSearch indexName={CHARTS_INDEX} searchClient={searchClient}>
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
