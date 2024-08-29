import React, { useEffect, useMemo, useReducer, useRef, useState } from "react"
import ReactDOM from "react-dom"
import cx from "classnames"
import {
    countriesByName,
    Country,
    Region,
    TagGraphRoot,
    Url,
    getPaginationPageNumbers,
} from "@ourworldindata/utils"
import algoliasearch, { SearchClient } from "algoliasearch"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { ChartHit } from "../search/ChartHit.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
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
    faPlus,
    faSearch,
} from "@fortawesome/free-solid-svg-icons"
import { LabeledSwitch } from "@ourworldindata/components"
import {
    useFocusTrap,
    useOffsetTop,
    useTriggerOnEscape,
    useTriggerWhenClickOutside,
} from "../hooks.js"
import {
    checkShouldShowRibbonView,
    DataCatalogCache,
    DataCatalogRibbonResult,
    DataCatalogSearchResult,
    getCountryData,
    queryRibbonsWithCache,
    querySearchWithCache,
    syncDataCatalogURL,
} from "./DataCatalogUtils.js"
import {
    dataCatalogStateToUrl,
    getInitialDatacatalogState,
    urlToDataCatalogState,
    dataCatalogReducer,
    DataCatalogState,
    createActions,
} from "./DataCatalogState.js"

const DataCatalogSearchInput = ({
    value,
    setQuery,
    onSubmit,
}: {
    value: string
    setQuery: (query: string) => void
    onSubmit: () => void
}) => {
    return (
        <div className="data-catalog-search-box-container">
            <form
                className="data-catalog-search-form"
                onSubmit={(e) => {
                    e.preventDefault()
                    onSubmit()
                }}
            >
                <input
                    type="text"
                    className="data-catalog-search-input body-3-regular"
                    placeholder="Search for an indicator, a topic, or a keyword &hellip;"
                    value={value}
                    onChange={(e) => {
                        setQuery(e.target.value)
                    }}
                />
                <button
                    className="data-catalog-clear-input-button"
                    disabled={!value}
                    aria-label="Clear search"
                    type="button"
                    onClick={(e) => {
                        e.preventDefault()
                        setQuery("")
                    }}
                >
                    <FontAwesomeIcon icon={faClose} />
                </button>
            </form>
        </div>
    )
}

function DataCatalogCountrySelector({
    selectedCountryNames,
    requireAllCountries,
    addCountry,
    removeCountry,
    toggleRequireAllCountries,
}: {
    selectedCountryNames: Set<string>
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
        if (selectedCountryNames.has(country)) {
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
                selectedCountryNames.has(country.name) ||
                country.name
                    .toLowerCase()
                    .includes(countrySearchQuery.toLowerCase())
        )
    }, [countrySearchQuery, selectedCountryNames, alphabetizedCountriesByName])

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
                <span className="data-catalog-country-selector-button__text">
                    Country selector
                </span>
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
                                                selectedCountryNames.has(
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
                                        checked={selectedCountryNames.has(
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
    selectedCountries,
    removeCountry,
}: {
    selectedCountries: Region[]
    removeCountry: (country: string) => void
}) => {
    const countryNameWidth = selectedCountries.reduce(
        (total, cur) => total + cur.name.length,
        0
    )
    // A rough heuristic to determine if we should consolidate the selected countries into a single button on desktop
    // We always show the consolidated button on mobile
    const shouldMinifyOnDesktop = countryNameWidth > 30
    const minifiedButton = selectedCountries.length ? (
        <div
            className={cx(
                "data-catalog-selected-country-pill data-catalog-selected-country-pill__mini",
                {
                    "data-catalog-selected-country-pill__mini--show-on-desktop":
                        shouldMinifyOnDesktop,
                }
            )}
        >
            <img
                width={20}
                height={16}
                src={`/images/flags/${selectedCountries[0].code}.svg`}
            />
            {selectedCountries.length - 1 ? (
                <span>+ {selectedCountries.length - 1} more</span>
            ) : null}
            <button
                aria-label={`Remove all country filters`}
                onClick={() => {
                    selectedCountries.forEach((country) => {
                        removeCountry(country.name)
                    })
                }}
            >
                <FontAwesomeIcon icon={faClose} />
            </button>
        </div>
    ) : null

    return (
        <div className="data-catalog-selected-countries-container">
            {selectedCountries.map((country) => (
                <div
                    key={country.code}
                    className={cx("data-catalog-selected-country-pill", {
                        "data-catalog-selected-country-pill--hide-on-desktop":
                            shouldMinifyOnDesktop,
                    })}
                >
                    <img
                        width={20}
                        height={16}
                        src={`/images/flags/${country.code}.svg`}
                    />
                    <span className="body-3-medium">{country.name}</span>
                    <button
                        aria-label={`Remove ${country.name}`}
                        onClick={() => {
                            removeCountry(country.name)
                        }}
                    >
                        <FontAwesomeIcon icon={faClose} />
                    </button>
                </div>
            ))}
            {minifiedButton}
        </div>
    )
}

const DataCatalogRibbon = ({
    result,
    addTopic,
    selectedCountries,
}: {
    result: DataCatalogRibbonResult
    addTopic: (x: string) => void
    selectedCountries: Region[]
}) => {
    if (result.nbHits === 0) return null
    const handleAddTopicClick = (e: React.MouseEvent) => {
        e.preventDefault()
        addTopic(result.title)
    }

    return (
        <div className="data-catalog-ribbon">
            <button
                className="data-catalog-ribbon__header-button"
                onClick={handleAddTopicClick}
            >
                <div className="data-catalog-ribbon__header">
                    <h2 className="body-1-regular">{result.title}</h2>
                    <span className="data-catalog-ribbon__hit-count body-2-semibold">
                        {result.nbHits} indicators
                        <FontAwesomeIcon icon={faArrowRight} />
                    </span>
                </div>
            </button>
            <div className="data-catalog-ribbon-hits">
                <ul className="data-catalog-ribbon-list grid grid-cols-4">
                    {result.hits.map((hit) => (
                        <li
                            className="data-catalog-ribbon-hit"
                            key={hit.objectID}
                        >
                            <ChartHit
                                hit={hit}
                                searchQueryRegionsMatches={selectedCountries}
                            />
                        </li>
                    ))}
                </ul>
            </div>
            <button
                className="data-catalog-ribbon__see-all-button"
                onClick={handleAddTopicClick}
            >
                See all {result.nbHits} indicators{" "}
                <FontAwesomeIcon icon={faArrowRight} />
            </button>
        </div>
    )
}

const DataCatalogRibbonView = ({
    results,
    addTopic,
    selectedCountries,
}: {
    results?: DataCatalogRibbonResult[]
    addTopic: (x: string) => void
    selectedCountries: Region[]
}) => {
    return (
        <div className="span-cols-12 col-start-2 data-catalog-ribbons">
            {results?.map((result) => (
                <DataCatalogRibbon
                    key={result.title}
                    result={result}
                    addTopic={addTopic}
                    selectedCountries={selectedCountries}
                />
            ))}
        </div>
    )
}

const DataCatalogResults = ({
    selectedCountries,
    results,
    setPage,
    addTopic,
    topics,
}: {
    results?: DataCatalogSearchResult
    selectedCountries: Region[]
    setPage: (page: number) => void
    addTopic: (topic: string) => void
    topics: Set<string>
}) => {
    const hits = results?.hits
    if (hits && hits.length) {
        return (
            <>
                <TopicsRefinementList
                    topics={topics}
                    facets={results.facets?.tags}
                    addTopic={addTopic}
                />
                <div className="span-cols-12 col-start-2 data-catalog-search-hits">
                    <ul className="data-catalog-search-list grid grid-cols-4 grid-sm-cols-1">
                        {hits.map((hit) => (
                            <li
                                className="data-catalog-search-hit"
                                key={hit.objectID}
                            >
                                <ChartHit
                                    hit={hit}
                                    searchQueryRegionsMatches={
                                        selectedCountries
                                    }
                                />
                            </li>
                        ))}
                    </ul>
                </div>
                <DataCatalogPagination
                    currentPage={results.page}
                    setPage={setPage}
                    nbPages={results.nbPages || 0}
                />
            </>
        )
    }
    return null
}

const AppliedTopicFiltersList = ({
    topics,
    removeTopic,
}: {
    topics: Set<string>
    removeTopic: (topic: string) => void
}) => {
    return (
        <ul className="data-catalog-applied-filters-list span-cols-12 col-start-2 ">
            {[...topics].map((topic) => {
                return (
                    <li
                        className="data-catalog-applied-filters-item"
                        key={topic}
                    >
                        <button
                            aria-label={`Remove filter ${topic}`}
                            className="data-catalog-applied-filters-button body-3-medium"
                            onClick={() => removeTopic(topic)}
                        >
                            {topic}
                            <FontAwesomeIcon icon={faClose} />
                        </button>
                    </li>
                )
            })}
        </ul>
    )
}

const TopicsRefinementList = ({
    topics,
    facets,
    addTopic,
}: {
    topics: Set<string>
    facets?: Record<string, number>
    addTopic: (topic: string) => void
}) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const entries = facets
        ? Object.entries(facets).filter(([facetName]) => {
              return !topics.has(facetName)
          })
        : []
    if (!entries.length)
        return (
            <div className="data-catalog-refinement-list span-cols-12 col-start-2" />
        )

    return (
        <div className="data-catalog-refinement-list span-cols-12 col-start-2">
            <button
                className="data-catalog-refinements-expand-button"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h5 className="h5-black-caps">Topics</h5>
                <FontAwesomeIcon icon={faPlus} />
            </button>
            <ul
                className={cx("data-catalog-refinement-list__list", {
                    "data-catalog-refinement-list__list--is-expanded":
                        isExpanded,
                })}
            >
                {entries.map(([facetName, count], i) => {
                    const isLast = i === entries.length - 1
                    return (
                        <React.Fragment key={i}>
                            <li className="data-catalog-refinement-list__list-item">
                                <button
                                    aria-label={`Filter by ${facetName}`}
                                    onClick={() => addTopic(facetName)}
                                >
                                    <span>{facetName}</span>
                                    <span className="data-catalog-refinement-list__list-item-hit-count body-3-medium">
                                        ({count})
                                    </span>
                                </button>
                            </li>
                            {!isLast ? (
                                <li
                                    className="data-catalog-refinement-list__separator"
                                    aria-hidden="true"
                                >
                                    {/* including an empty space so that the list has spaces in it when copied to clipboard */}{" "}
                                </li>
                            ) : null}
                        </React.Fragment>
                    )
                })}
            </ul>
        </div>
    )
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
    setPage,
    nbPages,
    currentPage,
}: {
    setPage: (page: number) => void
    currentPage: number
    nbPages: number
}) => {
    useEffect(() => {
        if (currentPage !== 0) {
            if (currentPage >= nbPages) {
                setPage(0)
            }
        }
    }, [currentPage, nbPages, setPage])

    if (nbPages === 0) return null

    const pages = getPaginationPageNumbers(currentPage, nbPages)

    return (
        <ol className="data-catalog-pagination span-cols-12 col-start-2">
            <li className="data-catalog-pagination__item">
                <button
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage === 0}
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
                            page === currentPage,
                    })}
                >
                    <button
                        onClick={() => setPage(page)}
                        disabled={page === currentPage}
                    >
                        {page + 1}
                    </button>
                </li>
            ))}
            <li className="data-catalog-pagination__item">
                <button
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage === nbPages - 1}
                >
                    <FontAwesomeIcon icon={faArrowRight} />
                </button>
            </li>
        </ol>
    )
}

const DataCatalogSearchbar = ({
    selectedCountries,
    query,
    setQuery,
    removeCountry,
    addCountry,
    requireAllCountries,
    selectedCountryNames,
    toggleRequireAllCountries,
}: {
    selectedCountries: Region[]
    selectedCountryNames: Set<string>
    query: string
    setQuery: (query: string) => void
    removeCountry: (country: string) => void
    addCountry: (country: string) => void
    requireAllCountries: boolean
    toggleRequireAllCountries: () => void
}) => {
    // Storing this in local state so that query params don't update during typing
    const [localValue, setLocalValue] = useState(query)
    const submit = () => setQuery(localValue)

    // Uses CSS to fake an input bar that will highlight correctly using :focus-within
    // without highlighting when the country selector is focused
    return (
        <>
            <div className="data-catalog-pseudo-input">
                <button
                    className="data-catalog-pseudo-input__submit-button"
                    onClick={submit}
                >
                    <FontAwesomeIcon icon={faSearch} />
                </button>
                <SelectedCountriesPills
                    selectedCountries={selectedCountries}
                    removeCountry={removeCountry}
                />
                <DataCatalogSearchInput
                    value={localValue}
                    setQuery={setLocalValue}
                    onSubmit={submit}
                />
            </div>
            <DataCatalogCountrySelector
                requireAllCountries={requireAllCountries}
                toggleRequireAllCountries={toggleRequireAllCountries}
                selectedCountryNames={selectedCountryNames}
                addCountry={addCountry}
                removeCountry={removeCountry}
            />
        </>
    )
}

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
    const actions = createActions(dispatch)
    const [isLoading, setIsLoading] = useState(false)
    const cache = useRef<DataCatalogCache>({
        ribbons: new Map(),
        search: new Map(),
    })
    const AREA_NAMES = useMemo(
        () => tagGraph.children.map((child) => child.name),
        [tagGraph]
    )
    const shouldShowRibbons = useMemo(
        () => checkShouldShowRibbonView(state.query, state.topics, AREA_NAMES),
        [state.query, state.topics, AREA_NAMES]
    )
    const selectedCountries = useMemo(
        () => getCountryData(state.selectedCountryNames),
        [state.selectedCountryNames]
    )

    const stateAsUrl = dataCatalogStateToUrl(state)
    const cacheKey = shouldShowRibbons ? "ribbons" : "search"
    const currentResults = cache.current[cacheKey].get(stateAsUrl)

    useEffect(() => {
        async function fetchData() {
            return shouldShowRibbons
                ? queryRibbonsWithCache(searchClient, state, tagGraph, cache)
                : querySearchWithCache(searchClient, state, cache)
        }
        syncDataCatalogURL(stateAsUrl)
        if (cache.current[cacheKey].has(stateAsUrl)) return
        setIsLoading(true)
        fetchData()
            .catch(console.error)
            .finally(() => setIsLoading(false))
    }, [state, searchClient, shouldShowRibbons, tagGraph, stateAsUrl, cacheKey])

    useEffect(() => {
        const handlePopState = () => {
            const url = Url.fromURL(window.location.href)
            actions.resetState(urlToDataCatalogState(url))
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
                    <DataCatalogSearchbar
                        selectedCountryNames={state.selectedCountryNames}
                        selectedCountries={selectedCountries}
                        requireAllCountries={state.requireAllCountries}
                        query={state.query}
                        toggleRequireAllCountries={
                            actions.toggleRequireAllCountries
                        }
                        setQuery={actions.setQuery}
                        removeCountry={actions.removeCountry}
                        addCountry={actions.addCountry}
                    />
                </div>
            </div>
            {isLoading && <DataCatalogLoadingSpinner />}
            {!isLoading && (
                <AppliedTopicFiltersList
                    topics={state.topics}
                    removeTopic={actions.removeTopic}
                />
            )}
            {!isLoading && shouldShowRibbons && (
                <DataCatalogRibbonView
                    results={currentResults as DataCatalogRibbonResult[]}
                    addTopic={actions.addTopic}
                    selectedCountries={selectedCountries}
                />
            )}
            {!isLoading && !shouldShowRibbons && (
                <DataCatalogResults
                    topics={state.topics}
                    results={currentResults as DataCatalogSearchResult}
                    selectedCountries={selectedCountries}
                    addTopic={actions.addTopic}
                    setPage={actions.setPage}
                />
            )}
        </>
    )
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
    const root = document.getElementById("data-catalog-page-root")
    const tagGraph = window._OWID_TAG_GRAPH as TagGraphRoot
    if (root) {
        ReactDOM.hydrate(
            <DataCatalogInstantSearchWrapper tagGraph={tagGraph} />,
            root
        )
    }
}
