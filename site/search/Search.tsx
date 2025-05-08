import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import * as React from "react"
import cx from "classnames"
import {
    commafyNumber,
    countriesByName,
    Country,
    Region,
    TagGraphRoot,
    Url,
    getPaginationPageNumbers,
    TagGraphNode,
} from "@ourworldindata/utils"
import algoliasearch, { SearchClient } from "algoliasearch"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { ChartHit } from "./ChartHit.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faArrowLeft,
    faArrowRight,
    faClose,
    faMagnifyingGlass,
    faMapMarkerAlt,
    faMinus,
    faPlus,
    faSearch,
    faTimesCircle,
} from "@fortawesome/free-solid-svg-icons"
import { LabeledSwitch } from "@ourworldindata/components"
import {
    useFocusTrap,
    useTriggerOnEscape,
    useTriggerWhenClickOutside,
} from "../hooks.js"
import {
    DataCatalogCache,
    DataCatalogRibbonResult,
    DataCatalogSearchResult,
} from "./searchTypes.js"
import {
    checkShouldShowRibbonView,
    getCountryData,
    queryRibbons,
    querySearch,
    syncDataCatalogURL,
    useAutocomplete,
} from "./searchUtils.js"
import {
    dataCatalogStateToUrl,
    getInitialDatacatalogState,
    urlToDataCatalogState,
    dataCatalogReducer,
    DataCatalogState,
    createActions,
} from "./searchState.js"
import {
    DataCatalogResultsSkeleton,
    DataCatalogRibbonViewSkeleton,
    LandingPageRefinementsHeading,
} from "./SearchSkeletons.js"
import { useMediaQuery } from "usehooks-ts"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import { SiteAnalytics } from "../SiteAnalytics.js"

const analytics = new SiteAnalytics()

const DataCatalogSearchInput = ({
    value,
    setLocalQuery,
    setGlobalQuery,
}: {
    value: string
    setLocalQuery: (query: string) => void
    setGlobalQuery: (query: string) => void
}) => {
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
    const inputRef = useRef<HTMLInputElement | null>(null)
    let placeholder = ""
    if (inputRef.current) {
        // Only set the placeholder once the component has rendered so that useMediaQuery has a chance to initialize
        // Otherwise on mobile it will flash from the desktop version to the mobile placeholder
        placeholder = isSmallScreen
            ? "Search data, topics, or keywords…"
            : "Search for an indicator, a topic, or a keyword…"
    }
    return (
        <div className="data-catalog-search-box-container">
            <form
                className="data-catalog-search-form"
                onSubmit={(e) => {
                    e.preventDefault()
                    // unfocus input to hide autocomplete/hide mobile keyboard
                    if (inputRef.current) {
                        inputRef.current.blur()
                    }
                    setGlobalQuery(value)
                }}
            >
                <input
                    autoFocus
                    type="text"
                    className="data-catalog-search-input body-3-regular"
                    ref={inputRef}
                    placeholder={placeholder}
                    enterKeyHint="search"
                    value={value}
                    onChange={(e) => {
                        setLocalQuery(e.target.value)
                        if (e.target.value === "") {
                            setGlobalQuery("")
                        }
                    }}
                    onBlur={(e) => {
                        const recipient = e.relatedTarget
                        if (!recipient?.hasAttribute("data-prevent-onblur")) {
                            setGlobalQuery(value)
                        }
                    }}
                />
                <button
                    className="data-catalog-clear-input-button"
                    disabled={!value}
                    aria-label="Clear search"
                    type="button"
                    onClick={() => {
                        // We have to set both because the user might not have submitted the search yet
                        setLocalQuery("")
                        setGlobalQuery("")
                    }}
                >
                    <FontAwesomeIcon icon={faTimesCircle} />
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
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
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

    const toggleOpen = () => {
        setIsOpen((isOpen) => !isOpen)
        // if opening on mobile, scroll down a little
        if (isSmallScreen && !isOpen) {
            setTimeout(() => {
                const listContainer = listContainerRef.current
                if (listContainer) {
                    const rect = listContainer.getBoundingClientRect()
                    window.scrollBy({
                        top: rect.top - 100,
                        behavior: "smooth",
                    })
                }
            }, 100)
        }
    }

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
                className={cx(
                    "data-catalog-country-selector-button body-3-medium",
                    {
                        "data-catalog-country-selector-button--is-open": isOpen,
                    }
                )}
                aria-expanded={isOpen}
                aria-label={
                    isOpen ? "Close country selector" : "Open country selector"
                }
                onClick={toggleOpen}
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
                        disabled={selectedCountryNames.size === 0}
                        onToggle={toggleRequireAllCountries}
                        label="Only show charts with data for all selected countries"
                    />
                    <div className="data-catalog-country-selector-search-container">
                        <FontAwesomeIcon
                            className="data-catalog-country-selector__search-icon"
                            icon={faMagnifyingGlass}
                        />
                        <input
                            type="text"
                            placeholder="Search for a country"
                            className="data-catalog-country-selector-search-input body-3-regular"
                            value={countrySearchQuery}
                            onChange={(e) =>
                                setCountrySearchQuery(e.target.value)
                            }
                        />
                        {countrySearchQuery && (
                            <button
                                onClick={() => setCountrySearchQuery("")}
                                data-label="Clear country search"
                                className="data-catalog-country-selector__clear-button"
                            >
                                <FontAwesomeIcon icon={faTimesCircle} />
                            </button>
                        )}
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
                aria-label="Remove all country filters"
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
        window.scrollTo({
            top: 0,
        })
    }

    return (
        <div className="data-catalog-ribbon col-start-2 span-cols-12 col-sm-start-2 span-sm-cols-13">
            <button
                className="data-catalog-ribbon__header-button"
                aria-label={`Add topic ${result.title} to filters`}
                onClick={handleAddTopicClick}
            >
                <div className="data-catalog-ribbon__header">
                    <h2 className="body-1-regular">{result.title}</h2>
                    <span className="data-catalog-ribbon__hit-count body-2-semibold">
                        {commafyNumber(result.nbHits)}{" "}
                        {result.nbHits === 1 ? "chart" : "charts"}
                        <FontAwesomeIcon icon={faArrowRight} />
                    </span>
                </div>
            </button>
            <div className="data-catalog-ribbon-hits">
                <ul className="data-catalog-ribbon-list grid grid-cols-4">
                    {result.hits.map((hit, i) => (
                        <li
                            className="data-catalog-ribbon-hit"
                            key={hit.objectID}
                        >
                            <ChartHit
                                hit={hit}
                                onClick={() => {
                                    analytics.logDataCatalogResultClick(
                                        hit,
                                        i + 1,
                                        "ribbon",
                                        result.title
                                    )
                                }}
                                searchQueryRegionsMatches={selectedCountries}
                            />
                        </li>
                    ))}
                </ul>
            </div>
            <button
                className="data-catalog-ribbon__see-all-button"
                aria-label={`Add ${result.title} to filters`}
                onClick={handleAddTopicClick}
            >
                {result.nbHits === 1
                    ? `See 1 chart`
                    : `See ${commafyNumber(result.nbHits)} charts`}
                <FontAwesomeIcon icon={faArrowRight} />
            </button>
        </div>
    )
}

const DataCatalogRibbonView = ({
    addTopic,
    results,
    selectedCountries,
    topics,
    isLoading,
}: {
    addTopic: (x: string) => void
    removeTopic: (topic: string) => void
    results?: DataCatalogRibbonResult[]
    selectedCountries: Region[]
    topics: Set<string>
    tagGraph: TagGraphRoot
    isLoading: boolean
}) => {
    if (isLoading) {
        return <DataCatalogRibbonViewSkeleton topics={topics} />
    }

    const resultsSortedByHitCount = results?.sort((a, b) => b.nbHits - a.nbHits)

    const ribbonFacets = resultsSortedByHitCount
        ? Object.fromEntries(
              resultsSortedByHitCount.map((result) => [
                  result.title,
                  result.nbHits,
              ])
          )
        : {}

    return (
        <>
            <LandingPageRefinementsHeading topics={topics} />
            <TopicsRefinementList
                topics={topics}
                facets={ribbonFacets}
                addTopic={addTopic}
            />
            <div className="span-cols-14 grid grid-cols-12-full-width data-catalog-ribbons">
                {resultsSortedByHitCount?.map((result) => (
                    <DataCatalogRibbon
                        key={result.title}
                        result={result}
                        addTopic={addTopic}
                        selectedCountries={selectedCountries}
                    />
                ))}
            </div>
        </>
    )
}

const DataCatalogNoResults = () => {
    return (
        <div className="data-catalog-search-no-results span-cols-12 col-start-2">
            <FontAwesomeIcon
                className="data-catalog-search-no-results__icon"
                icon={faSearch}
            />
            <h2 className="body-1-regular">
                There are no results for this query.
            </h2>
            <p className="body-3-medium">
                Try searching for something else or removing some filters.
            </p>
        </div>
    )
}

const DataCatalogResults = ({
    selectedCountries,
    results,
    setPage,
    addTopic,
    topics,
    isLoading,
}: {
    results?: DataCatalogSearchResult
    selectedCountries: Region[]
    setPage: (page: number) => void
    addTopic: (topic: string) => void
    topics: Set<string>
    isLoading: boolean
}) => {
    if (isLoading) return <DataCatalogResultsSkeleton />

    const hits = results?.hits
    if (!hits || !hits.length) return <DataCatalogNoResults />

    const { facets, page, nbPages, nbHits } = results
    return (
        <>
            <TopicsRefinementList
                topics={topics}
                facets={facets?.tags}
                addTopic={addTopic}
            />
            <div className="span-cols-12 col-start-2 data-catalog-search-hits">
                {nbHits && (
                    <p className="data-catalog-search-list__results-count body-3-medium">
                        {commafyNumber(nbHits)}{" "}
                        {nbHits === 1 ? "indicator" : "indicators"}
                    </p>
                )}
                <ul className="data-catalog-search-list grid grid-cols-4 grid-sm-cols-1">
                    {hits.map((hit, i) => (
                        <li
                            className="data-catalog-search-hit"
                            key={hit.objectID}
                        >
                            <ChartHit
                                onClick={() => {
                                    analytics.logDataCatalogResultClick(
                                        hit,
                                        i + 1,
                                        "search"
                                    )
                                }}
                                hit={hit}
                                searchQueryRegionsMatches={selectedCountries}
                            />
                        </li>
                    ))}
                </ul>
            </div>
            <DataCatalogPagination
                currentPage={page}
                setPage={setPage}
                nbPages={nbPages}
            />
        </>
    )
}

const AppliedTopicFiltersList = ({
    topics,
    removeTopic,
}: {
    topics: Set<string>
    removeTopic: (topic: string) => void
}) => {
    return (
        <ul className="data-catalog-applied-filters-list span-cols-12 col-start-2">
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
        ? Object.entries(facets).filter(([facetName, matches]) => {
              // Only show topics that haven't already been selected that have matches
              return !topics.has(facetName) && !!matches
          })
        : []
    if (!entries.length)
        return (
            <div className="data-catalog-refinement-list span-cols-12 col-start-2" />
        )

    return (
        <div className="data-catalog-refinement-list span-cols-12 col-start-2">
            <button
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse topics" : "Expand topics"}
                className="data-catalog-refinements-expand-button"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h5 className="h5-black-caps">Filter by topic</h5>
                <FontAwesomeIcon icon={isExpanded ? faMinus : faPlus} />
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
                                    <span className="body-3-bold">
                                        {facetName}
                                    </span>{" "}
                                    <span className="body-3-regular">
                                        ({commafyNumber(count)})
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
        if (currentPage > nbPages) {
            setPage(0)
        }
    }, [currentPage, nbPages, setPage])

    if (nbPages < 2) return null

    function handlePageClick(page: number) {
        setPage(page)
        window.scrollTo({
            top: 0,
        })
    }

    const pages = getPaginationPageNumbers(currentPage, nbPages)

    return (
        <ol className="data-catalog-pagination span-cols-12 col-start-2">
            <li className="data-catalog-pagination__item">
                <button
                    onClick={() => handlePageClick(currentPage - 1)}
                    aria-label="Go to previous page"
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
                        onClick={() => handlePageClick(page)}
                        aria-label={`Go to page ${page + 1}`}
                        disabled={page === currentPage}
                    >
                        {page + 1}
                    </button>
                </li>
            ))}
            <li className="data-catalog-pagination__item">
                <button
                    onClick={() => handlePageClick(currentPage + 1)}
                    aria-label="Go to next page"
                    disabled={currentPage === nbPages - 1}
                >
                    <FontAwesomeIcon icon={faArrowRight} />
                </button>
            </li>
        </ol>
    )
}

function AutocompleteItemContents({
    type,
    name,
}: {
    type: string
    name: string
}) {
    if (type === "country") {
        return (
            <span className="country">
                <img
                    className="flag"
                    aria-hidden={true}
                    height={12}
                    width={16}
                    src={`/images/flags/${countriesByName()[name].code}.svg`}
                />
                {name}
            </span>
        )
    }
    if (type === "topic") {
        return <span className="topic">{name}</span>
    }
    if (type === "query") {
        return (
            <span>
                <FontAwesomeIcon icon={faSearch} />
                {name}
            </span>
        )
    }
    return null
}

const DataCatalogAutocomplete = ({
    localQuery,
    allTopics,
    selectedCountryNames,
    selectedTopics,
    query,
    setLocalQuery,
    setQuery,
    addCountry,
    addTopic,
}: {
    localQuery: string
    allTopics: string[]
    selectedCountryNames: Set<string>
    selectedTopics: Set<string>
    query: string
    setLocalQuery: (query: string) => void
    setQuery: (query: string) => void
    addCountry: (country: string) => void
    addTopic: (topic: string) => void
}) => {
    const items = useAutocomplete(localQuery, allTopics, {
        selectedCountryNames,
        selectedTopics,
    })
    const itemsToRender = useMemo(
        () => [{ name: localQuery, type: "query" }, ...items],
        [localQuery, items]
    )

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key
            const input = document.querySelector(
                ".data-catalog-search-input"
            ) as HTMLInputElement
            const pseudoinput = document.querySelector(
                ".data-catalog-pseudo-input:focus-within"
            ) as HTMLInputElement
            if (!pseudoinput) {
                return
            }
            const focusableItems = [
                ...document.querySelectorAll(
                    ".data-catalog-autocomplete-button"
                ),
            ] as HTMLElement[]
            const currentIndex = document.activeElement
                ? focusableItems.indexOf(document.activeElement as HTMLElement)
                : null

            switch (key) {
                case "ArrowDown":
                    e.preventDefault()
                    if (currentIndex === null) {
                        focusableItems[0].focus()
                    } else if (currentIndex < itemsToRender.length - 1) {
                        focusableItems[currentIndex + 1].focus()
                    }
                    break
                case "ArrowUp":
                    e.preventDefault()
                    if (currentIndex === null) {
                        focusableItems[0].focus()
                    } else if (currentIndex > 0) {
                        focusableItems[currentIndex - 1].focus()
                    } else if (currentIndex === 0) {
                        input.focus()
                    }
                    break
                case "Escape":
                    e.preventDefault()
                    ;(document.activeElement as HTMLElement).blur()
                    break
            }
        }

        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [
        items,
        itemsToRender,
        addCountry,
        addTopic,
        setLocalQuery,
        setQuery,
        query,
    ])

    if (!localQuery) return null
    return (
        <div className="data-catalog-autocomplete-container">
            <ul>
                {itemsToRender.map(({ name, type }) => (
                    <li
                        key={name}
                        className={cx("data-catalog-autocomplete-item")}
                    >
                        <button
                            data-prevent-onblur
                            className="data-catalog-autocomplete-button"
                            onClick={() => {
                                const queryMinusLastWord = query
                                    .split(" ")
                                    .slice(0, -1)
                                    .join(" ")
                                if (type === "country") {
                                    addCountry(name)
                                }
                                if (type === "topic") {
                                    addTopic(name)
                                }
                                if (type === "query") {
                                    setLocalQuery(name)
                                    setQuery(name)
                                    ;(
                                        document.activeElement as HTMLElement
                                    ).blur()
                                    return
                                }
                                setLocalQuery(queryMinusLastWord)
                                setQuery(queryMinusLastWord)
                            }}
                        >
                            <AutocompleteItemContents type={type} name={name} />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

const DataCatalogSearchbar = ({
    allTopics,
    selectedTopics,
    selectedCountries,
    query,
    setQuery,
    removeCountry,
    addCountry,
    addTopic,
    requireAllCountries,
    selectedCountryNames,
    toggleRequireAllCountries,
}: {
    allTopics: string[]
    selectedTopics: Set<string>
    selectedCountries: Region[]
    selectedCountryNames: Set<string>
    query: string
    setQuery: (query: string) => void
    removeCountry: (country: string) => void
    addCountry: (country: string) => void
    addTopic: (topic: string) => void
    requireAllCountries: boolean
    toggleRequireAllCountries: () => void
}) => {
    // Storing this in local state so that query params don't update during typing
    const [localQuery, setLocalQuery] = useState(query)
    // sync local query with global query when browser navigation occurs
    useEffect(() => {
        setLocalQuery(query)
    }, [query])

    // Uses CSS to fake an input bar that will highlight correctly using :focus-within
    // without highlighting when the country selector is focused
    return (
        <>
            <div className="data-catalog-pseudo-input">
                <button
                    className="data-catalog-pseudo-input__submit-button"
                    aria-label="Submit search"
                    onClick={() => setQuery(localQuery)}
                >
                    <FontAwesomeIcon icon={faSearch} />
                </button>
                <SelectedCountriesPills
                    selectedCountries={selectedCountries}
                    removeCountry={removeCountry}
                />
                <DataCatalogSearchInput
                    value={localQuery}
                    setLocalQuery={setLocalQuery}
                    setGlobalQuery={setQuery}
                />
                <DataCatalogAutocomplete
                    localQuery={localQuery}
                    allTopics={allTopics}
                    selectedCountryNames={selectedCountryNames}
                    selectedTopics={selectedTopics}
                    query={query}
                    setLocalQuery={setLocalQuery}
                    setQuery={setQuery}
                    addCountry={addCountry}
                    addTopic={addTopic}
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
    const [cache, setCache] = useState<DataCatalogCache>({
        ribbons: new Map(),
        search: new Map(),
    })
    const AREA_NAMES = useMemo(
        () => tagGraph.children.map((child) => child.name),
        [tagGraph]
    )
    const ALL_TOPICS = useMemo(() => {
        function getAllTopics(node: TagGraphNode): Set<string> {
            return node.children.reduce((acc, child) => {
                if (child.children.length) {
                    const topics = getAllTopics(child)
                    return new Set([...acc, ...topics])
                }
                if (child.isTopic) {
                    acc.add(child.name)
                }
                return acc
            }, new Set<string>())
        }
        return Array.from(getAllTopics(tagGraph))
    }, [tagGraph])

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
    const currentResults = cache[cacheKey].get(stateAsUrl)

    useEffect(() => {
        // Reconstructing state from the `stateAsUrl` serialization to avoid a `state` dependency in this effect,
        // which would cause it to run on every state change (even no-ops)
        const url = Url.fromURL(stateAsUrl)
        const state = urlToDataCatalogState(url)
        analytics.logDataCatalogSearch(state)
    }, [stateAsUrl])

    useEffect(() => {
        async function fetchData() {
            const results = shouldShowRibbons
                ? await queryRibbons(searchClient, state, tagGraph)
                : await querySearch(searchClient, state)
            setCache((prevCache) => ({
                ...prevCache,
                [cacheKey]: prevCache[cacheKey].set(stateAsUrl, results as any),
            }))
        }

        syncDataCatalogURL(stateAsUrl)
        if (cache[cacheKey].has(stateAsUrl)) return

        setIsLoading(true)
        void fetchData().then(() => setIsLoading(false))
        return () => setIsLoading(false)
    }, [
        state,
        searchClient,
        shouldShowRibbons,
        tagGraph,
        stateAsUrl,
        cacheKey,
        cache,
    ])

    useEffect(() => {
        const handlePopState = () => {
            const url = Url.fromURL(window.location.href)
            actions.setState(urlToDataCatalogState(url))
        }
        window.addEventListener("popstate", handlePopState)
        return () => {
            window.removeEventListener("popstate", handlePopState)
        }
    }, [actions])

    return (
        <>
            <div className="data-catalog-header span-cols-14 grid grid-cols-12-full-width">
                <header className="data-catalog-heading span-cols-12 col-start-2">
                    <h1 className="h1-semibold">Data Catalog</h1>
                    <p className="body-2-regular">
                        Search for a specific chart, or browse all our charts by
                        area and topic.
                    </p>
                </header>
                <div className="data-catalog-search-controls-container span-cols-12 col-start-2">
                    <DataCatalogSearchbar
                        allTopics={ALL_TOPICS}
                        selectedTopics={state.topics}
                        addCountry={actions.addCountry}
                        addTopic={actions.addTopic}
                        query={state.query}
                        removeCountry={actions.removeCountry}
                        requireAllCountries={state.requireAllCountries}
                        selectedCountries={selectedCountries}
                        selectedCountryNames={state.selectedCountryNames}
                        setQuery={actions.setQuery}
                        toggleRequireAllCountries={
                            actions.toggleRequireAllCountries
                        }
                    />
                </div>
            </div>
            <AppliedTopicFiltersList
                topics={state.topics}
                removeTopic={actions.removeTopic}
            />
            {shouldShowRibbons ? (
                <DataCatalogRibbonView
                    addTopic={actions.addTopic}
                    isLoading={isLoading}
                    removeTopic={actions.removeTopic}
                    results={currentResults as DataCatalogRibbonResult[]}
                    selectedCountries={selectedCountries}
                    tagGraph={tagGraph}
                    topics={state.topics}
                />
            ) : (
                <DataCatalogResults
                    addTopic={actions.addTopic}
                    isLoading={isLoading}
                    results={currentResults as DataCatalogSearchResult}
                    selectedCountries={selectedCountries}
                    setPage={actions.setPage}
                    topics={state.topics}
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
