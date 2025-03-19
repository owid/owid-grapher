import { useEffect, useRef, useState } from "react"
import * as React from "react"
import { render } from "react-dom"
import urljoin from "url-join"
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
    ChartRecordType,
    PageType,
    SearchIndexName,
    WordpressPageType,
    pageTypeDisplayNames,
} from "./searchTypes.js"
import { getCanonicalUrl } from "@ourworldindata/components"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../../settings/clientSettings.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
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

// The slugs we index to Algolia don't include grapher/, explorers/, or data-insights/ subdirectories
// Prepend them with this function when we need them
const prependSubdirectoryToAlgoliaItemUrl = (item: BaseItem): string => {
    const indexName = parseIndexName(item.__autocomplete_indexName as string)
    return match(indexName)
        .with(SearchIndexName.ExplorerViews, () => {
            return urljoin(
                BAKED_BASE_URL,
                EXPLORERS_ROUTE_FOLDER,
                item.explorerSlug as string,
                item.viewQueryParams as string
            )
        })
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
                        item.explorerSlug as string,
                        item.viewQueryParams as string
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
        .with(SearchIndexName.SearchSuggestions, () =>
            urljoin(
                BAKED_BASE_URL,
                "/data",
                queryParamsToStr({ q: item.suggestion as string })
            )
        )
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
                slug: `/search${queryParamsToStr({ q: term })}`,
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

const QuerySuggestionsSource: AutocompleteSource<BaseItem> = {
    sourceId: "querySuggestions",
    onSelect({ navigator, item, state }) {
        navigator.navigate({
            itemUrl: prependSubdirectoryToAlgoliaItemUrl(item),
            item,
            state,
        })
    },
    getItemUrl({ item }) {
        const itemUrl = prependSubdirectoryToAlgoliaItemUrl(item)
        return itemUrl
    },
    getItems({ query }) {
        // Only suggest queries when there are at least 2 characters
        if (!query || query.length < 2) {
            return []
        }

        return getAlgoliaResults({
            searchClient,
            queries: [
                {
                    indexName: getIndexName(SearchIndexName.SearchSuggestions),
                    query,
                    params: {
                        hitsPerPage: 10,
                    },
                },
            ],
        })
    },
    templates: {
        header: () => <h5 className="overline-black-caps">Suggestions</h5>,
        item: ({ item }) => {
            return (
                <div className="aa-ItemWrapper">
                    <span>{item.suggestion}</span>
                </div>
            )
        },
    },
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
                    itemUrl: `/search${queryParamsToStr({ q: state.query })}`,
                    // this method is incorrectly typed - `item` and `state` are optional
                } as any)
            },
            renderer: {
                createElement: React.createElement,
                Fragment: React.Fragment,
                render: render as Render,
            },
            getSources({ query }) {
                const sources: AutocompleteSource<BaseItem>[] = []
                if (query) {
                    sources.push(
                        QuerySuggestionsSource,
                        AlgoliaSource,
                        AllResultsSource
                    )
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
