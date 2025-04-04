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
import { match, P } from "ts-pattern"
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
import {
    CatalogFilter,
    CatalogFilterType,
    QueryType,
    SearchRelaxationMode,
} from "./DataCatalogState"
import { CountryPill } from "./CountryPill"
import { TopicPill } from "./TopicPill"
import { DataCatalogAppliedFilters } from "./DataCatalogAppliedFilters.js"

// Define enum for source IDs
enum Sources {
    RECENT_SEARCHES = "recentSearches",
    SUGGESTED_SEARCH = "suggestedSearch",
    AUTOCOMPLETE = "autocomplete",
    COUNTRIES = "countries",
    TOPICS = "topics",
    COMBINED_FILTERS = "combinedFilters",
    RUN_SEARCH = "runSearch",
}

const siteAnalytics = new SiteAnalytics()

type BaseItem = Record<string, unknown>

enum AutocompleteItemType {
    Country = "country",
    TopicPage = "topic-page",
    LinearTopicPage = "linear-topic-page",
}

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
    sourceId: Sources.SUGGESTED_SEARCH,
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
    sourceId: Sources.AUTOCOMPLETE,
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
                        filters: `NOT type:${AutocompleteItemType.TopicPage} AND NOT type:${AutocompleteItemType.Country}`,
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
        sourceId: Sources.COUNTRIES,
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
                        <CountryPill
                            name={item.title as string}
                            code={
                                countriesByName()[item.title as string]?.code ||
                                ""
                            }
                        />
                        {unmatchedQuery && (
                            <div className="body-3-regular">
                                {unmatchedQuery}
                            </div>
                        )}
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
        sourceId: Sources.TOPICS,
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
                        <TopicPill name={topicTag} />
                        {unmatchedQuery && (
                            <div className="body-3-regular">
                                {unmatchedQuery}
                            </div>
                        )}
                    </div>
                )
            },
        },
    }
}

const CombinedFiltersSource = (
    addPendingFilter: (filter: CatalogFilter) => void,
    clearSearch: () => void
): AutocompleteSource<BaseItem> => {
    return {
        sourceId: Sources.COMBINED_FILTERS,
        onSelect({ item }) {
            // Apply the topic
            if (item.topic) {
                addPendingFilter({
                    type: CatalogFilterType.TOPIC,
                    name: item.topic as string,
                })
            }

            // Apply all countries
            if (item.countries) {
                ;(item.countries as string[]).forEach((country) => {
                    addPendingFilter({
                        type: CatalogFilterType.COUNTRY,
                        name: country,
                    })
                })
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
            header: () => {
                return (
                    <h5 className="overline-black-caps">🧪 Combined Filters</h5>
                )
            },
            item: ({ item }) => {
                const countries = (item.countries as string[]) || []
                const topic = item.topic as string | undefined

                return (
                    <div className="aa-ItemWrapper aa-CombinedFiltersWrapper">
                        <div className="aa-ItemContent">
                            <div
                                className="aa-ItemContentBody"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    gap: "4px",
                                }}
                            >
                                {topic && <TopicPill name={topic} />}
                                {countries.length > 0 && (
                                    <div
                                        style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: "4px",
                                        }}
                                    >
                                        {countries.map((country) => (
                                            <CountryPill
                                                key={country}
                                                name={country}
                                                code={
                                                    countriesByName()[country]
                                                        ?.code || ""
                                                }
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
    sourceId: Sources.RUN_SEARCH,
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

        // const clearSearch = () => {
        //     setQueryRef.current("")
        //     // Clear the input directly
        //     if (search) {
        //         search.setQuery("")
        //     }
        // }

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

                // If the active item is not null, we need to add it to the pending filters
                // Find the active item and source
                const activeItem = state.collections
                    .flatMap((collection) => collection.items)
                    .find(
                        (item) => item.__autocomplete_id === state.activeItemId
                    )

                if (!activeItem) return

                search.setQuery(getUnmatchedQueryPart(activeItem, state.query))

                const shouldAddActiveItem = prevState.activeItemId === null

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
                if (query && query.length >= minQueryLength) {
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
                    // sources.push(
                    //     CombinedFiltersSource(
                    //         addPendingFilterRef.current,
                    //         clearSearch
                    //     )
                    // )
                    sources.push(/*AlgoliaSource,*/ AllResultsSource)
                } else {
                    sources.push(FeaturedSearchesSource)
                }
                return sources
            },
            reshape({ sources, sourcesBySourceId }) {
                const countries =
                    sourcesBySourceId[Sources.COUNTRIES]?.getItems() || []
                const topics =
                    sourcesBySourceId[Sources.TOPICS]?.getItems() || []

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
                            if (source.sourceId === Sources.COMBINED_FILTERS) {
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
