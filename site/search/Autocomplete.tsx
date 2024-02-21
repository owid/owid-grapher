import React, { useEffect } from "react"
import { render } from "react-dom"
import {
    AutocompleteSource,
    Render,
    autocomplete,
    getAlgoliaResults,
} from "@algolia/autocomplete-js"
import algoliasearch from "algoliasearch"
import { createLocalStorageRecentSearchesPlugin } from "@algolia/autocomplete-plugin-recent-searches"
import {
    PageType,
    SearchIndexName,
    indexNameToSubdirectoryMap,
    pageTypeDisplayNames,
} from "./searchTypes.js"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

type BaseItem = Record<string, unknown>

const recentSearchesPlugin = createLocalStorageRecentSearchesPlugin({
    key: "RECENT_SEARCH",
    limit: 3,
    transformSource({ source }) {
        return {
            ...source,
            onSelect({ item, navigator }) {
                navigator.navigate({ itemUrl: `/search?q=${item.id}` } as any)
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
    const indexName = item.__autocomplete_indexName as SearchIndexName
    const subdirectory = indexNameToSubdirectoryMap[indexName]
    return `${subdirectory}/${item.slug}`
}

const FeaturedSearchesSource: AutocompleteSource<BaseItem> = {
    sourceId: "suggestedSearch",
    onSelect,
    getItemUrl,
    getItems() {
        // TODO: this should probably be integrated with GDOCS_HOMEPAGE_CONFIG_DOCUMENT_ID for v2
        return ["COVID-19", "Energy", "GDP", "Poverty", "CO2"].map((term) => ({
            title: term,
            slug: `/search?q=${term}`,
        }))
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
                    indexName: SearchIndexName.Pages,
                    query,
                    params: {
                        hitsPerPage: 2,
                        distinct: true,
                    },
                },
                {
                    indexName: SearchIndexName.Charts,
                    query,
                    params: {
                        hitsPerPage: 2,
                        distinct: true,
                    },
                },
                {
                    indexName: SearchIndexName.Explorers,
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
            const index = item.__autocomplete_indexName as SearchIndexName
            const indexLabel =
                index === SearchIndexName.Charts
                    ? "Chart"
                    : index === SearchIndexName.Explorers
                    ? "Explorer"
                    : pageTypeDisplayNames[item.type as PageType]

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
                        {indexLabel}
                    </span>
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
                slug: `/search?q=${encodeURI(query)}`,
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
    placeholder = "Search for a topic, chart or article...",
    detachedMediaQuery = "(max-width: 960px)",
    panelClassName,
}: {
    onActivate?: () => void
    onClose?: () => void
    className?: string
    placeholder?: string
    detachedMediaQuery?: string
    panelClassName?: string
}) {
    useEffect(() => {
        const search = autocomplete({
            placeholder,
            detachedMediaQuery,
            container: AUTOCOMPLETE_CONTAINER_ID,
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
                    itemUrl: `/search?q=${state.query}`,
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
                    sources.push(AlgoliaSource, AllResultsSource)
                } else {
                    sources.push(FeaturedSearchesSource)
                }
                return sources
            },
            plugins: [recentSearchesPlugin],
        })

        const container = document.querySelector(AUTOCOMPLETE_CONTAINER_ID)
        if (container) {
            const input = container.querySelector<HTMLInputElement>("input")
            if (input) {
                const inputId = input.id
                const button = container.querySelector(
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
        }

        return () => search.destroy()
    }, [onActivate, onClose, placeholder, detachedMediaQuery])

    return <div className={className} id="autocomplete" />
}
