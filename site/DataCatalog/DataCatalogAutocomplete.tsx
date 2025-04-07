import { useEffect, useRef, useState, useCallback } from "react"
import * as React from "react"
import { render } from "react-dom"
import {
    AutocompleteApi,
    AutocompleteSource,
    Render,
    autocomplete,
    getAlgoliaResults,
} from "@algolia/autocomplete-js"
import { createLocalStorageRecentSearchesPlugin } from "@algolia/autocomplete-plugin-recent-searches"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { countriesByName, queryParamsToStr } from "@ourworldindata/utils"
import Mousetrap from "mousetrap"
import { match, P } from "ts-pattern"
import {
    getIndexName,
    DEFAULT_SEARCH_PLACEHOLDER,
} from "../search/searchClient.js"
import { SearchIndexName } from "../search/searchTypes.js"
import {
    CatalogFilter,
    CatalogFilterType,
    QueryType,
    SearchRelaxationMode,
} from "./DataCatalogState"
import { CountryPill } from "./CountryPill"
import { TopicPill } from "./TopicPill"
import { DataCatalogAppliedFilters } from "./DataCatalogAppliedFilters.js"
import {
    AutocompleteItemType,
    searchClient,
    AutocompleteSources,
    getActiveItemCollection,
} from "./DataCatalogUtils.js"
import { AlgoliaSource } from "./AlgoliaSource.js"
import { CombinedFiltersSource } from "./CombinedFiltersSource.js"

export type BaseItem = Record<string, unknown>

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

const FeaturedSearchesSource: AutocompleteSource<BaseItem> = {
    sourceId: AutocompleteSources.SUGGESTED_SEARCH,
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

// Extract the unmatched part of the query using Algolia's matchedWords
const getUnmatchedQueryPart = (item: BaseItem, query: string): string => {
    const matchedWords =
        (item._highlightResult as any)?.title?.matchedWords || []

    if (!query || matchedWords.length === 0) return ""

    // Split the query into words and filter out those that matched
    const queryWords = query.toLowerCase().split(/\s+/)
    const unmatchedWords = queryWords.filter(
        (word) =>
            !matchedWords.some(
                (matchedWord: string) => matchedWord.toLowerCase() === word
            )
    )
    return unmatchedWords.join(" ")
}

const CountriesSource = (
    pendingFilters: CatalogFilter[],
    searchRelaxationMode: SearchRelaxationMode,
    queryType: QueryType,
    typoTolerance: boolean
): AutocompleteSource<BaseItem> => {
    return {
        sourceId: AutocompleteSources.COUNTRIES,
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
                            filters: `type:${AutocompleteItemType.Country}`,
                            removeWordsIfNoResults: searchRelaxationMode,
                            restrictSearchableAttributes: ["title"],
                            queryType: queryType,
                            typoTolerance: typoTolerance,
                        },
                    },
                ],
            })
        },

        templates: {
            item: ({ item, state }) => {
                const unmatchedQuery = getUnmatchedQueryPart(item, state.query)

                return (
                    <div
                        className="aa-ItemWrapper"
                        key={item.title as string}
                        translate="no"
                    >
                        <DataCatalogAppliedFilters filters={pendingFilters} />
                        {unmatchedQuery && (
                            <div className="body-3-regular">
                                {unmatchedQuery}
                            </div>
                        )}
                        <CountryPill
                            name={item.title as string}
                            code={
                                countriesByName()[item.title as string]?.code ||
                                ""
                            }
                        />
                    </div>
                )
            },
        },
    }
}

const TopicsSource = (
    pendingFilters: CatalogFilter[],
    searchRelaxationMode: SearchRelaxationMode,
    queryType: QueryType,
    typoTolerance: boolean
): AutocompleteSource<BaseItem> => {
    return {
        sourceId: AutocompleteSources.TOPICS,
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
                            filters: `type:${AutocompleteItemType.TopicPage} OR type:${AutocompleteItemType.LinearTopicPage}`,
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
                            queryType: queryType,
                            typoTolerance: typoTolerance,
                        },
                    },
                ],
            })
        },

        templates: {
            item: ({ item, state }) => {
                const topicTag = (item.tags as string[])?.[0] || ""
                const unmatchedQuery = getUnmatchedQueryPart(item, state.query)

                return (
                    <div
                        className="aa-ItemWrapper"
                        key={item.title as string}
                        translate="no"
                    >
                        <DataCatalogAppliedFilters filters={pendingFilters} />
                        {unmatchedQuery && (
                            <div className="body-3-regular">
                                {unmatchedQuery}
                            </div>
                        )}
                        <TopicPill name={topicTag} />
                    </div>
                )
            },
        },
    }
}

const AllResultsSource: AutocompleteSource<BaseItem> = {
    sourceId: AutocompleteSources.RUN_SEARCH,
    onSelect,
    getItemUrl,
    getItems({ query }) {
        return [
            {
                slug: `/data${queryParamsToStr({ q: query })}`,
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
    onClose,
    className,
    placeholder = DEFAULT_SEARCH_PLACEHOLDER,
    // A magic number slightly higher than our $md breakpoint to ensure there's enough room
    // for everything in the site nav between 960-1045px. Mirrored in Autocomplete.scss
    detachedMediaQuery = "(max-width: 1045px)",
    panelClassName,
    setQuery,
    query,
    addFilter,
    pendingFilters,
    upsertLastFilter,
    removeLastFilter,
    searchRelaxationMode,
    queryType,
    typoTolerance,
    minQueryLength,
}: {
    onClose?: () => void
    className?: string
    placeholder?: string
    detachedMediaQuery?: string
    panelClassName?: string
    setQuery: (query: string) => void
    query?: string
    addFilter: (filter: CatalogFilter) => void
    pendingFilters: CatalogFilter[]
    upsertLastFilter: (shouldAdd: boolean, filter: CatalogFilter) => void
    removeLastFilter: () => void
    searchRelaxationMode: SearchRelaxationMode
    queryType: QueryType
    typoTolerance: boolean
    minQueryLength: number
}) {
    const containerRef = useRef<HTMLDivElement>(null)

    const [search, setSearch] = useState<AutocompleteApi<BaseItem> | null>(null)

    // Store in ref for stable reference
    const setQueryRef = useRef(setQuery)
    const addPendingFilterRef = useRef(addFilter)
    const upsertLastFilterRef = useRef(upsertLastFilter)
    const removeLastFilterRef = useRef(removeLastFilter)
    const pendingFiltersRef = useRef<CatalogFilter[]>(pendingFilters)

    // Update the ref whenever pendingFilters change. This is to prevent the
    // autocomplete instance from being recreated on every filter change, while
    // keeping the state in the parent
    useEffect(() => {
        pendingFiltersRef.current = pendingFilters
    }, [pendingFilters])

    const positionPanel = useCallback(() => {
        // Forced DOM manipulation of the algolia autocomplete panel position
        // This ensures the panel is properly positioned at the bottom of the search input
        setTimeout(() => {
            const panel = document.querySelector<HTMLElement>(".aa-Panel")
            const pseudoInput = document.querySelector<HTMLElement>(
                ".data-catalog-pseudo-input"
            )
            if (panel && pseudoInput) {
                const bounds = pseudoInput.getBoundingClientRect()
                panel.style.top = `${bounds.height + 5}px`
            }
        }, 10)
    }, [])

    useEffect(() => {
        setQueryRef.current = setQuery
        addPendingFilterRef.current = addFilter
        upsertLastFilterRef.current = upsertLastFilter
        removeLastFilterRef.current = removeLastFilter
    }, [addFilter, removeLastFilter, setQuery, upsertLastFilter])

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
            panelPlacement: "full-width",
            panelContainer: ".data-catalog-search-box-container",
            detachedMediaQuery,
            container: containerRef.current,
            classNames: {
                panel: panelClassName,
            },
            openOnFocus: true,
            onStateChange({ state, prevState }) {
                if (!prevState.isOpen && state.isOpen) {
                    positionPanel()
                } else if (onClose && prevState.isOpen && !state.isOpen) {
                    onClose()
                }

                // Add item to state on select
                const activeItemChanged =
                    state.activeItemId !== prevState.activeItemId

                if (!activeItemChanged) return

                // Find the active item and its source
                const activeItemCollection = getActiveItemCollection(state)

                const activeItem = activeItemCollection?.items.find(
                    (item) => item.__autocomplete_id === state.activeItemId
                )

                if (
                    !activeItem ||
                    !activeItemCollection ||
                    activeItemCollection.source.sourceId ===
                        AutocompleteSources.RUN_SEARCH
                )
                    return

                // If the active item is not null, we need to add it to the pending filters
                search.setQuery(getUnmatchedQueryPart(activeItem, state.query))

                const shouldAddActiveItem =
                    prevState.activeItemId === null ||
                    getActiveItemCollection(prevState)?.source.sourceId ===
                        AutocompleteSources.RUN_SEARCH

                match(activeItem.type as AutocompleteItemType)
                    .with(AutocompleteItemType.Country, () => {
                        upsertLastFilterRef.current(shouldAddActiveItem, {
                            type: CatalogFilterType.COUNTRY,
                            name: activeItem.title as string,
                        })
                    })
                    .with(
                        P.union(
                            AutocompleteItemType.TopicPage,
                            AutocompleteItemType.LinearTopicPage
                        ),
                        () => {
                            upsertLastFilterRef.current(shouldAddActiveItem, {
                                type: CatalogFilterType.TOPIC,
                                // For some topics there is a discrepancy between the page title and the tag
                                // (e.g. "Happiness and Life Satisfaction" vs "Happiness & Life Satisfaction")
                                // so we need to make sure to use the tag name (and not the page title) when faceting
                                // We could be using searchForFacetValues() instead but it doesn't support
                                // the removeWordsIfNoResults parameter
                                name: (activeItem.tags as string[])[0],
                            })
                        }
                    )
                    .otherwise(() => {
                        // Catch-all for other non-referenced item types
                    })
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
                const debugOnlyCoreSources = true
                if (query && query.length >= minQueryLength) {
                    sources.push(AlgoliaSource, AllResultsSource)
                    sources.push(
                        CountriesSource(
                            pendingFiltersRef.current,
                            searchRelaxationMode,
                            queryType,
                            typoTolerance
                        )
                    )
                    sources.push(
                        TopicsSource(
                            pendingFiltersRef.current,
                            searchRelaxationMode,
                            queryType,
                            typoTolerance
                        )
                    )

                    // Add the combined filters source
                    sources.push(
                        CombinedFiltersSource(
                            addPendingFilterRef.current,
                            clearSearch
                        )
                    )
                } else {
                    sources.push(FeaturedSearchesSource)
                }

                // Only keep core sources
                if (debugOnlyCoreSources) {
                    return sources.filter(
                        (source) =>
                            ![
                                AutocompleteSources.AUTOCOMPLETE,
                                AutocompleteSources.COMBINED_FILTERS,
                            ].includes(source.sourceId as AutocompleteSources)
                    )
                }

                return sources
            },
            reshape({ sources, sourcesBySourceId }) {
                const countries =
                    sourcesBySourceId[
                        AutocompleteSources.COUNTRIES
                    ]?.getItems() || []
                const topics =
                    sourcesBySourceId[AutocompleteSources.TOPICS]?.getItems() ||
                    []

                const countryNames = countries.map(
                    (country) => country.title as string
                )

                return (
                    sources
                        // .filter(
                        //     // Remove the countries and topics sources since their
                        //     // components are already included in the combined filters
                        //     // source
                        //     (source) =>
                        //         ![Sources.TOPICS, Sources.COUNTRIES].includes(
                        //             source.sourceId as Sources
                        //         )
                        // )
                        // Update combined filter source with one item per topic
                        .map((source) => {
                            if (
                                source.sourceId ===
                                AutocompleteSources.COMBINED_FILTERS
                            ) {
                                return {
                                    ...source,
                                    getItems() {
                                        // If there are topics, create one item per topic with all countries
                                        if (topics.length > 0) {
                                            return topics.map((topic) => ({
                                                topic: (
                                                    topic.tags as string[]
                                                )?.[0], // use the first tag on the topic page record as the topic name
                                                countries: countryNames,
                                            }))
                                        }
                                        // If there are no topics but there are countries, create a single item with all countries
                                        else if (countryNames.length > 0) {
                                            return [
                                                {
                                                    countries: countryNames,
                                                },
                                            ]
                                        }

                                        return []
                                    },
                                }
                            }
                            return source
                        })
                )
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
        onClose,
        placeholder,
        detachedMediaQuery,
        panelClassName,
        containerRef,
        query,
        searchRelaxationMode,
        queryType,
        typoTolerance,
        minQueryLength,
        positionPanel,
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
