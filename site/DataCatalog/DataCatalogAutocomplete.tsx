import { useEffect, useRef, useState } from "react"
import * as React from "react"
import { render } from "react-dom"
import {
    AutocompleteApi,
    AutocompleteSource,
    Render,
    autocomplete,
    getAlgoliaResults,
} from "@algolia/autocomplete-js"
import algoliasearch from "algoliasearch"
import { createLocalStorageRecentSearchesPlugin } from "@algolia/autocomplete-plugin-recent-searches"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { countriesByName, queryParamsToStr } from "@ourworldindata/utils"
import { SiteAnalytics } from "../SiteAnalytics.js"
import Mousetrap from "mousetrap"
import {
    parseIndexName,
    getIndexName,
    DEFAULT_SEARCH_PLACEHOLDER,
} from "../search/searchClient.js"
import {
    indexNameToSubdirectoryMap,
    SearchIndexName,
    pageTypeDisplayNames,
    PageType,
} from "../search/searchTypes.js"
import { SearchRelaxationMode } from "./DataCatalogState"
import { CountryPill } from "./CountryPill"

const siteAnalytics = new SiteAnalytics()

type BaseItem = Record<string, unknown>

const recentSearchesPlugin = createLocalStorageRecentSearchesPlugin({
    key: "RECENT_SEARCH",
    limit: 3,
    transformSource({ source }) {
        return {
            ...source,
            onSelect({ item, navigator }) {
                navigator.navigate({
                    itemUrl: `/search${queryParamsToStr({ q: item.id })}`,
                } as any)
            },
            templates: {
                ...source.templates,
                header() {
                    return (
                        <h5 className="overline-black-caps">Recent Searches</h5>
                    )
                },
            },
        }
    },
})

const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)

// This is the same simple function for the two non-Algolia sources
const onSelect: AutocompleteSource<BaseItem>["onSelect"] = ({
    navigator,
    item,
    state,
}) => {
    const itemUrl = item.slug as string
    navigator.navigate({ itemUrl, item, state })
}

// This is the same simple function for the two non-Algolia sources
const getItemUrl: AutocompleteSource<BaseItem>["getItemUrl"] = ({ item }) =>
    item.slug as string

// The slugs we index to Algolia don't include the /grapher/ or /explorers/ directories
// Prepend them with this function when we need them
const prependSubdirectoryToAlgoliaItemUrl = (item: BaseItem): string => {
    const indexName = parseIndexName(item.__autocomplete_indexName as string)
    const subdirectory = indexNameToSubdirectoryMap[indexName]
    switch (indexName) {
        case SearchIndexName.ExplorerViews:
            return `${subdirectory}/${item.explorerSlug}${item.viewQueryParams}`
        default:
            return `${subdirectory}/${item.slug}`
    }
}

const FeaturedSearchesSource: AutocompleteSource<BaseItem> = {
    sourceId: "suggestedSearch",
    onSelect,
    getItemUrl,
    getItems() {
        return ["CO2", "Energy", "Education", "Poverty", "Democracy"].map(
            (term) => ({
                title: term,
                slug: `/data${queryParamsToStr({ q: term })}`,
            })
        )
    },

    templates: {
        header: () => (
            <h5 className="overline-black-caps">Featured Searches</h5>
        ),
        item: ({ item }) => {
            return (
                <div>
                    <span>{item.title}</span>
                </div>
            )
        },
    },
}

const AlgoliaSource: AutocompleteSource<BaseItem> = {
    sourceId: "autocomplete",
    onSelect({ navigator, item, state }) {
        const itemUrl = prependSubdirectoryToAlgoliaItemUrl(item)
        siteAnalytics.logInstantSearchClick({
            query: state.query,
            url: itemUrl,
            position: String(state.activeItemId),
        })
        navigator.navigate({ itemUrl, item, state })
    },
    getItemUrl({ item }) {
        const itemUrl = prependSubdirectoryToAlgoliaItemUrl(item)
        return itemUrl
    },
    getItems({ query }) {
        return getAlgoliaResults({
            searchClient,
            queries: [
                {
                    indexName: getIndexName(SearchIndexName.Pages),
                    query,
                    params: {
                        hitsPerPage: 2,
                        distinct: true,
                        filters: "NOT type:topic-page AND NOT type:country",
                    },
                },
                {
                    indexName: getIndexName(SearchIndexName.Charts),
                    query,
                    params: {
                        hitsPerPage: 2,
                        distinct: true,
                    },
                },
                {
                    indexName: getIndexName(SearchIndexName.ExplorerViews),
                    query,
                    params: {
                        hitsPerPage: 1,
                        distinct: true,
                    },
                },
            ],
        })
    },

    templates: {
        header: () => <h5 className="overline-black-caps">Top Results</h5>,
        item: ({ item, components }) => {
            const index = parseIndexName(
                item.__autocomplete_indexName as string
            )
            const indexLabel =
                index === SearchIndexName.Charts
                    ? "Chart"
                    : index === SearchIndexName.ExplorerViews
                      ? "Explorer"
                      : pageTypeDisplayNames[item.type as PageType]

            const mainAttribute =
                index === SearchIndexName.ExplorerViews ? "viewTitle" : "title"

            return (
                <div
                    className="aa-ItemWrapper"
                    key={item.title as string}
                    translate="no"
                >
                    <span>
                        <components.Highlight
                            hit={item}
                            attribute={mainAttribute}
                            tagName="strong"
                        />
                    </span>
                    <span className="aa-ItemWrapper__contentType">
                        {indexLabel}
                    </span>
                </div>
            )
        },
    },
}

const CountriesSource = (
    addCountry: (country: string) => void,
    clearSearch: () => void,
    searchRelaxationMode: SearchRelaxationMode
): AutocompleteSource<BaseItem> => {
    return {
        sourceId: "countries",
        onSelect({ item }) {
            addCountry(item.title as string)
            clearSearch()
        },

        getItemUrl() {
            return undefined
        },
        getItems({ query }) {
            if (!query) return []

            return getAlgoliaResults({
                searchClient,
                queries: [
                    {
                        indexName: getIndexName(SearchIndexName.Pages),
                        query,
                        params: {
                            hitsPerPage: 3,
                            filters: "type:country",
                            removeWordsIfNoResults: searchRelaxationMode,
                        },
                    },
                ],
            })
        },

        templates: {
            header: () => <h5 className="overline-black-caps">Countries</h5>,
            item: ({ item }) => {
                return (
                    <div
                        className="aa-ItemWrapper"
                        key={item.title as string}
                        translate="no"
                    >
                        <CountryPill
                            name={item.title as string}
                            code={
                                countriesByName()[item.title as string]?.code ||
                                ""
                            }
                            className="aa-CountryPill"
                        />
                        <span className="aa-ItemWrapper__contentType">
                            Country
                        </span>
                    </div>
                )
            },
        },
    }
}

const TopicsSource = (
    addTopic: (topic: string) => void,
    clearSearch: () => void,
    searchRelaxationMode: SearchRelaxationMode
): AutocompleteSource<BaseItem> => {
    return {
        sourceId: "topics",
        onSelect({ item }) {
            // For some topics there is a discrepancy between the page title and the tag
            // (e.g. "Happiness and Life Satisfaction" vs "Happiness & Life Satisfaction")
            // so we need to make sure to use the tag name (and not the page title) when faceting
            // We could be using searchForFacetValues() instead but it doesn't support
            // the removeWordsIfNoResults parameter
            addTopic((item.tags as string[])[0])
            clearSearch()
        },

        getItemUrl() {
            return undefined
        },
        getItems({ query }) {
            if (!query) return []

            return getAlgoliaResults({
                searchClient,
                queries: [
                    {
                        indexName: getIndexName(SearchIndexName.Pages),
                        query,
                        params: {
                            hitsPerPage: 3,
                            filters:
                                "type:topic-page OR type:linear-topic-page",
                            removeWordsIfNoResults: searchRelaxationMode,
                            // we sometimes mention country names in the content
                            // of topic pages, so searching in the content would
                            // surface unwanted results (e.g. "population
                            // france" surfaces "Time Use" because "France" is
                            // mentioned in the content). Similarly, we don't
                            // want to search in the excerpt (typing "Papua New
                            // Guinea" returns topics where the word new is used
                            // in the excerpt).
                            restrictSearchableAttributes: ["title"],
                        },
                    },
                ],
            })
        },

        templates: {
            header: () => <h5 className="overline-black-caps">Topics</h5>,
            item: ({ item, components }) => {
                return (
                    <div
                        className="aa-ItemWrapper"
                        key={item.title as string}
                        translate="no"
                    >
                        <span>
                            <components.Highlight
                                hit={item}
                                attribute="title"
                                tagName="strong"
                            />
                        </span>
                        <span className="aa-ItemWrapper__contentType">
                            Topic
                        </span>
                    </div>
                )
            },
        },
    }
}

const CombinedFiltersSource = (
    addCountry: (country: string) => void,
    addTopic: (topic: string) => void,
    clearSearch: () => void
): AutocompleteSource<BaseItem> => {
    return {
        sourceId: "combinedFilters",
        onSelect({ item }) {
            // Apply all countries
            if (item.countries) {
                ;(item.countries as string[]).forEach((country) => {
                    addCountry(country)
                })
            }

            // Apply topic if available
            if (item.topicTag) {
                addTopic(item.topicTag as string)
            }

            clearSearch()
        },
        getItemUrl() {
            return undefined
        },
        getItems() {
            // This is a placeholder - actual items are provided through the reshape function
            return []
        },
        templates: {
            header: () => (
                <h5 className="overline-black-caps">Apply Filters</h5>
            ),
            item: ({ item }) => {
                const countries = (item.countries as string[]) || []
                const topicTag = item.topicTag as string

                return (
                    <div className="aa-ItemWrapper aa-CombinedFiltersWrapper">
                        <div className="aa-ItemContent">
                            <div className="aa-ItemIcon">
                                <FontAwesomeIcon icon={faSearch} />
                            </div>
                            <div
                                className="aa-ItemContentBody"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                {topicTag && (
                                    <span className="aa-TopicTag">
                                        {topicTag}
                                    </span>
                                )}
                                {countries.length > 0 && (
                                    <div
                                        className="aa-CountryPillContainer"
                                        style={{ display: "flex" }}
                                    >
                                        {countries.map((country) => (
                                            <CountryPill
                                                key={country}
                                                name={country}
                                                code={
                                                    countriesByName()[country]
                                                        ?.code || ""
                                                }
                                                className="aa-CountryPill"
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            },
        },
    }
}

const AllResultsSource: AutocompleteSource<BaseItem> = {
    sourceId: "runSearch",
    onSelect,
    getItemUrl,
    getItems({ query }) {
        return [
            {
                slug: `/search${queryParamsToStr({ q: query })}`,
                title: `All search results for "${query}"`,
            },
        ]
    },

    templates: {
        item: ({ item }) => {
            return (
                <div className="aa-ItemWrapper">
                    <div className="aa-ItemContent">
                        <div className="aa-ItemIcon">
                            <FontAwesomeIcon icon={faSearch} />
                        </div>
                        <div className="aa-ItemContentBody">{item.title}</div>
                    </div>
                </div>
            )
        },
    },
}

export const AUTOCOMPLETE_CONTAINER_ID = "#autocomplete"

export function DataCatalogAutocomplete({
    onActivate,
    onClose,
    className,
    placeholder = DEFAULT_SEARCH_PLACEHOLDER,
    // A magic number slightly higher than our $md breakpoint to ensure there's enough room
    // for everything in the site nav between 960-1045px. Mirrored in Autocomplete.scss
    detachedMediaQuery = "(max-width: 1045px)",
    panelClassName,
    setQuery,
    query,
    addCountry,
    addTopic,
    searchRelaxationMode,
}: {
    onActivate?: () => void
    onClose?: () => void
    className?: string
    placeholder?: string
    detachedMediaQuery?: string
    panelClassName?: string
    setQuery: (query: string) => void
    query?: string
    addCountry: (country: string) => void
    addTopic: (topic: string) => void
    searchRelaxationMode: SearchRelaxationMode
}) {
    const containerRef = useRef<HTMLDivElement>(null)

    const [search, setSearch] = useState<AutocompleteApi<BaseItem> | null>(null)

    // Store in ref for stable reference
    const setQueryRef = useRef(setQuery)
    const addCountryRef = useRef(addCountry)
    const addTopicRef = useRef(addTopic)

    useEffect(() => {
        setQueryRef.current = setQuery
    }, [setQuery])

    useEffect(() => {
        addCountryRef.current = addCountry
    }, [addCountry])

    useEffect(() => {
        addTopicRef.current = addTopic
    }, [addTopic])

    useEffect(() => {
        if (!containerRef.current) return

        const clearSearch = () => {
            setQueryRef.current("")
            // Clear the input directly
            if (search) {
                search.setQuery("")
            }
        }

        const search = autocomplete({
            placeholder,
            detachedMediaQuery,
            container: containerRef.current,
            classNames: {
                panel: panelClassName,
            },
            openOnFocus: true,
            onStateChange({ state, prevState }) {
                if (onActivate && !prevState.isOpen && state.isOpen) {
                    onActivate()
                } else if (onClose && prevState.isOpen && !state.isOpen) {
                    onClose()
                }
            },
            onSubmit({ state }) {
                if (!state.query) return
                setQueryRef.current(state.query)
            },
            onReset() {
                setQueryRef.current("")
            },
            renderer: {
                createElement: React.createElement,
                Fragment: React.Fragment,
                render: render as Render,
            },
            getSources({ query }) {
                const sources: AutocompleteSource<BaseItem>[] = []
                if (query) {
                    // Add the combined filters source
                    sources.push(
                        CombinedFiltersSource(
                            addCountryRef.current,
                            addTopicRef.current,
                            clearSearch
                        )
                    )

                    if (addCountryRef.current) {
                        sources.push(
                            CountriesSource(
                                addCountryRef.current,
                                clearSearch,
                                searchRelaxationMode
                            )
                        )
                    }
                    if (addTopicRef.current) {
                        sources.push(
                            TopicsSource(
                                addTopicRef.current,
                                clearSearch,
                                searchRelaxationMode
                            )
                        )
                    }
                    sources.push(AlgoliaSource, AllResultsSource)
                } else {
                    sources.push(FeaturedSearchesSource)
                }
                return sources
            },
            reshape({ sources, sourcesBySourceId }) {
                // Only reshape if we have query results
                if (
                    !sourcesBySourceId.combinedFilters ||
                    (!sourcesBySourceId.countries && !sourcesBySourceId.topics)
                ) {
                    return sources
                }

                const countries = sourcesBySourceId.countries.getItems() || []
                const topics = sourcesBySourceId.topics.getItems() || []

                // If we don't have any countries or topics, don't show combined filter
                if (countries.length === 0 && topics.length === 0) {
                    return sources.filter(
                        (source) => source.sourceId !== "combinedFilters"
                    )
                }

                const countryNames = countries.map(
                    (country) => country.title as string
                )
                let topicName = null
                let topicTag = null

                if (topics.length > 0) {
                    topicName = topics[0].title as string
                    topicTag = (topics[0].tags as string[])?.[0] || topicName
                }

                // Create display text based on available results
                let displayText = ""
                if (topicName && countryNames.length > 0) {
                    displayText = `${topicName} in ${countryNames.join(", ")}`
                } else if (topicName) {
                    displayText = topicName
                } else if (countryNames.length > 0) {
                    displayText = countryNames.join(", ")
                }

                // Update combined filter source with the data
                return sources.map((source) => {
                    if (source.sourceId === "combinedFilters") {
                        return {
                            ...source,
                            getItems() {
                                return [
                                    {
                                        title: displayText,
                                        topicTag,
                                        countries: countryNames,
                                    },
                                ]
                            },
                        }
                    }
                    return source
                })
            },
            plugins: [recentSearchesPlugin],
        })

        setSearch(search)

        const input =
            containerRef.current.querySelector<HTMLInputElement>("input")
        if (input) {
            const inputId = input.id
            const button = containerRef.current.querySelector(
                `label[for='${inputId}'] button`
            )
            // Disable the button on mount. We know there's no input because the element is created by JS
            // and thus isn't persisted between navigations
            button?.setAttribute("disabled", "true")

            input.addEventListener("input", () => {
                const isFormValid = input.checkValidity()
                if (isFormValid) {
                    button?.removeAttribute("disabled")
                } else {
                    button?.setAttribute("disabled", "true")
                }
            })
        }

        return () => search.destroy()
    }, [
        onActivate,
        onClose,
        placeholder,
        detachedMediaQuery,
        panelClassName,
        containerRef,
        query,
        searchRelaxationMode,
    ])

    // Sync external query changes (from the URL) to the input
    useEffect(() => {
        if (search && query !== undefined) {
            search.setQuery(query)
        }
    }, [search, query])

    // Register a global shortcut to open the search box on typing "/"
    useEffect(() => {
        if (!search) return

        Mousetrap.bind("/", (e) => {
            e.preventDefault() // don't type "/" into input
            search.setIsOpen(true)

            const input =
                containerRef.current?.querySelector<HTMLInputElement>("input")
            input?.focus()
        })

        return () => {
            Mousetrap.unbind("/")
        }
    }, [search, containerRef])

    return <div className={className} ref={containerRef} id="autocomplete" />
}
