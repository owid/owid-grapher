import { useRef, useState, useEffect } from "react"
import * as React from "react"
import { createRoot, Root } from "react-dom/client"
import urljoin from "url-join"
import { useTopicTagGraph, useTagGraphTopics } from "./searchHooks.js"
import {
    AutocompleteApi,
    AutocompleteSource,
    autocomplete,
    getAlgoliaResults,
} from "@algolia/autocomplete-js"
import algoliasearch from "algoliasearch"
import { createLocalStorageRecentSearchesPlugin } from "@algolia/autocomplete-plugin-recent-searches"
import {
    ChartRecordType,
    PageType,
    SearchIndexName,
    WordpressPageType,
    Filter,
    FilterType,
} from "./searchTypes.js"
import { getCanonicalUrl } from "@ourworldindata/components"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../../settings/clientSettings.js"
import {
    DEFAULT_SEARCH_PLACEHOLDER,
    getIndexName,
    parseIndexName,
} from "./searchClient.js"
import { OwidGdocType, queryParamsToStr } from "@ourworldindata/utils"
import { SiteAnalytics } from "../SiteAnalytics.js"
import Mousetrap from "mousetrap"
import { match } from "ts-pattern"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import {
    getAutocompleteSuggestionsWithUnmatchedQuery,
    getFilterIcon,
    getItemUrlForFilter,
    getPageTypeNameAndIcon,
} from "./searchUtils.js"
import { SearchFilterPill } from "./SearchFilterPill.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faChartSimple,
    faLineChart,
    faSearch,
} from "@fortawesome/free-solid-svg-icons"

const siteAnalytics = new SiteAnalytics()
const SEARCH_BASE_PATH = "/data"

type BaseItem = Record<string, unknown>

const recentSearchesPlugin = createLocalStorageRecentSearchesPlugin({
    key: "RECENT_SEARCH",
    limit: 3,
    transformSource({ source }) {
        return {
            ...source,
            onSelect({ item, navigator }) {
                navigator.navigate({
                    itemUrl: `${SEARCH_BASE_PATH}${queryParamsToStr({ q: item.id })}`,
                } as any)
            },
        }
    },
})

const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)

const onSelect: AutocompleteSource<BaseItem>["onSelect"] = ({
    navigator,
    item,
    state,
}) => {
    const itemUrl = item.slug as string
    navigator.navigate({ itemUrl, item, state })
}

const getItemUrl: AutocompleteSource<BaseItem>["getItemUrl"] = ({ item }) =>
    item.slug as string

// The slugs we index to Algolia don't include grapher/, explorers/, or data-insights/ subdirectories
// Prepend them with this function when we need them
const prependSubdirectoryToAlgoliaItemUrl = (item: BaseItem): string => {
    const indexName = parseIndexName(item.__autocomplete_indexName as string)
    return match(indexName)
        .with(SearchIndexName.Charts, () => {
            return urljoin(BAKED_GRAPHER_URL, item.slug as string)
        })
        .with(SearchIndexName.Pages, () => {
            if (
                item.type === WordpressPageType.Country ||
                item.type === WordpressPageType.Other
            ) {
                return urljoin(BAKED_BASE_URL, item.slug as string)
            }
            return getCanonicalUrl(BAKED_BASE_URL, {
                slug: item.slug as string,
                content: {
                    type: item.type as OwidGdocType,
                },
            })
        })
        .with(SearchIndexName.ExplorerViewsMdimViewsAndCharts, () => {
            return match(item.type as ChartRecordType)
                .with(ChartRecordType.ExplorerView, () => {
                    return urljoin(
                        BAKED_BASE_URL,
                        EXPLORERS_ROUTE_FOLDER,
                        item.slug as string,
                        item.queryParams as string
                    )
                })
                .with(ChartRecordType.Chart, () => {
                    return urljoin(BAKED_GRAPHER_URL, item.slug as string)
                })
                .with(ChartRecordType.MultiDimView, () => {
                    return urljoin(
                        BAKED_GRAPHER_URL,
                        item.slug as string,
                        item.queryParams as string
                    )
                })
                .exhaustive()
        })
        .exhaustive()
}

const FeaturedSearchesSource: AutocompleteSource<BaseItem> = {
    sourceId: "suggestedSearch",
    onSelect,
    getItemUrl,
    getItems() {
        return ["CO2", "Energy", "Education", "Poverty", "Democracy"].map(
            (term) => ({
                title: term,
                slug: `${SEARCH_BASE_PATH}${queryParamsToStr({ q: term })}`,
            })
        )
    },

    templates: {
        item: ({ item }) => {
            return (
                <span className="autocomplete-item-contents">
                    <span className="autocomplete-item-contents__type-icon">
                        <FontAwesomeIcon icon={faSearch} />
                    </span>
                    <span className="autocomplete-item-contents__query autocomplete-item-contents__query--only">
                        {item.title as string}
                    </span>
                </span>
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
                    },
                },
                {
                    indexName: getIndexName(
                        SearchIndexName.ExplorerViewsMdimViewsAndCharts
                    ),
                    query,
                    params: {
                        hitsPerPage: 3,
                        distinct: true,
                    },
                },
            ],
        })
    },

    templates: {
        item: ({ item, components }) => {
            const index = parseIndexName(
                item.__autocomplete_indexName as string
            )

            const indexLabel =
                index === SearchIndexName.ExplorerViewsMdimViewsAndCharts
                    ? item.type === ChartRecordType.ExplorerView
                        ? "Explorer"
                        : "Chart"
                    : getPageTypeNameAndIcon(item.type as PageType).name

            const indexIcon =
                index === SearchIndexName.ExplorerViewsMdimViewsAndCharts
                    ? faLineChart
                    : getPageTypeNameAndIcon(item.type as PageType).icon

            return (
                <span
                    className="autocomplete-item-contents"
                    key={item.title as string}
                    translate="no"
                >
                    <span>
                        <FontAwesomeIcon
                            icon={indexIcon}
                            className="autocomplete-item-contents__type-icon"
                        />
                    </span>
                    <span>
                        <components.Highlight
                            hit={item}
                            attribute={"title"}
                            tagName="strong"
                        />
                        <span className="autocomplete-item-contents__contentType">
                            {indexLabel}
                        </span>
                    </span>
                </span>
            )
        },
    },
}

const createFiltersSource = (
    allTopics: string[]
): AutocompleteSource<BaseItem> => ({
    sourceId: "filters",
    onSelect,
    getItemUrl,
    getItems({ query }) {
        if (!query.trim()) return []

        const suggestions = getAutocompleteSuggestionsWithUnmatchedQuery(
            query,
            allTopics,
            [], // no selected filters in this context
            1
        )

        const items: {
            filter: Filter
            unmatchedQuery: string
            slug: string
        }[] = []

        suggestions.suggestions.forEach((filter) => {
            items.push({
                filter,
                unmatchedQuery: suggestions.unmatchedQuery,
                slug: getItemUrlForFilter(filter),
            })
        })
        return items
    },
    templates: {
        item: ({ item }) => {
            const filter = item.filter as Filter
            const unmatchedQuery = item.unmatchedQuery as string

            return (
                <span className="autocomplete-item-contents">
                    {match(filter.type)
                        .with(FilterType.QUERY, () => (
                            <>
                                <span className="autocomplete-item-contents__type-icon">
                                    <FontAwesomeIcon icon={faSearch} />
                                </span>
                                <span className="autocomplete-item-contents__query autocomplete-item-contents__query--only autocomplete-item-contents__query--highlighted">
                                    {filter.name}
                                </span>
                            </>
                        ))
                        .with(FilterType.COUNTRY, () => (
                            <>
                                <span className="autocomplete-item-contents__type-icon">
                                    <FontAwesomeIcon icon={faSearch} />
                                </span>
                                {unmatchedQuery && (
                                    <span className="autocomplete-item-contents__query autocomplete-item-contents__query--unmatched">
                                        {unmatchedQuery}
                                    </span>
                                )}
                                <SearchFilterPill
                                    name={filter.name}
                                    icon={getFilterIcon(filter)}
                                />
                            </>
                        ))
                        .with(FilterType.TOPIC, () => (
                            <>
                                <span className="autocomplete-item-contents__type-icon">
                                    <FontAwesomeIcon icon={faSearch} />
                                </span>
                                <span className="autocomplete-item-contents__description">
                                    All
                                </span>
                                <span className="autocomplete-item-contents__description autocomplete-item-contents__description--type">
                                    <FontAwesomeIcon icon={faChartSimple} />
                                    data
                                </span>
                                <span className="autocomplete-item-contents__description">
                                    on
                                </span>
                                <SearchFilterPill
                                    name={filter.name}
                                    icon={getFilterIcon(filter)}
                                />
                            </>
                        ))
                        .exhaustive()}
                </span>
            )
        },
    },
})

export const AUTOCOMPLETE_CONTAINER_ID = "#autocomplete"

export function Autocomplete({
    onActivate,
    onClose,
    className,
    placeholder = DEFAULT_SEARCH_PLACEHOLDER,
    // A magic number slightly higher than our $md breakpoint to ensure there's enough room
    // for everything in the site nav between 960-1045px. Mirrored in Autocomplete.scss
    detachedMediaQuery = "(max-width: 1045px)",
    panelClassName,
}: {
    onActivate?: () => void
    onClose?: () => void
    className?: string
    placeholder?: string
    detachedMediaQuery?: string
    panelClassName?: string
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const panelRootRef = useRef<Root | null>(null)
    const rootRef = useRef<HTMLElement | null>(null)
    const { allTopics } = useTagGraphTopics(useTopicTagGraph())

    const [search, setSearch] = useState<AutocompleteApi<BaseItem> | null>(null)

    useEffect(() => {
        if (!containerRef.current) return

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
            onSubmit({ state, navigator }) {
                if (!state.query) return
                navigator.navigate({
                    itemUrl: `${SEARCH_BASE_PATH}${queryParamsToStr({ q: state.query })}`,
                    // this method is incorrectly typed - `item` and `state` are optional
                } as any)
            },
            renderer: {
                createElement: React.createElement,
                Fragment: React.Fragment,
                render: () => {
                    // empty method, see https://www.algolia.com/doc/ui-libraries/autocomplete/integrations/using-react/#with-react-18
                },
            },
            render({ children }, root) {
                if (!panelRootRef.current || rootRef.current !== root) {
                    rootRef.current = root

                    panelRootRef.current?.unmount()
                    panelRootRef.current = createRoot(root)
                }

                panelRootRef.current.render(children)
            },
            getSources({ query }) {
                const sources: AutocompleteSource<BaseItem>[] = []
                if (query) {
                    sources.push(createFiltersSource(allTopics), AlgoliaSource)
                } else {
                    sources.push(FeaturedSearchesSource)
                }
                return sources
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
        allTopics,
    ])

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
