import { useRef, useState, useEffect, useMemo } from "react"
import * as React from "react"
import { createRoot, Root } from "react-dom/client"
import urljoin from "url-join"
import { useTopicTagGraph, useTagGraphTopics } from "./searchHooks.js"
import {
    AutocompleteApi,
    AutocompleteSource,
    autocomplete,
} from "@algolia/autocomplete-js"
import { createLocalStorageRecentSearchesPlugin } from "@algolia/autocomplete-plugin-recent-searches"
import {
    ChartRecordType,
    Filter,
    FilterType,
    SynonymMap,
    SearchResultType,
} from "@ourworldindata/types"
import { getCanonicalUrl } from "@ourworldindata/components"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../../settings/clientSettings.js"
import { getTypesenseClient } from "./typesense/typesenseClient.js"
import { DEFAULT_SEARCH_PLACEHOLDER } from "./searchClient.js"
import {
    PAGES_INDEX,
    CHARTS_INDEX,
    suggestFiltersFromQuerySuffix,
    getFilterIcon,
    getItemUrlForFilter,
    getPageTypeNameAndIcon,
    SEARCH_BASE_PATH,
} from "./searchUtils.js"
import {
    getUserCountryInformation,
    listedRegionsNames,
    OwidGdocType,
    queryParamsToStr,
} from "@ourworldindata/utils"
import { SiteAnalytics } from "../SiteAnalytics.js"
import Mousetrap from "mousetrap"
import * as Sentry from "@sentry/react"
import { match } from "ts-pattern"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { buildSynonymMap } from "./synonymUtils.js"
import { SearchFilterPill } from "./SearchFilterPill.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLineChart, faSearch } from "@fortawesome/free-solid-svg-icons"

export const AUTOCOMPLETE_CONTAINER_ID = "#autocomplete"
// A magic number slightly higher than our $md breakpoint to ensure there's
// enough room for everything in the site nav between 960-1045px. Related to
// vars in Autocomplete.scss.
export const DETACHED_MODE_MAX_WIDTH = 1045
const DETACHED_MEDIA_QUERY = `(max-width: ${DETACHED_MODE_MAX_WIDTH}px)`

const siteAnalytics = new SiteAnalytics()
type BaseItem = Record<string, unknown>

// Per-instance factory: the plugin holds internal subscription state, so
// sharing one plugin object across multiple Autocomplete instances causes
// state from one instance (e.g. open panel) to leak into another.
const buildRecentSearchesPlugin = () =>
    createLocalStorageRecentSearchesPlugin({
        key: "RECENT_SEARCH",
        limit: 3,
        transformSource({ source }) {
            return {
                ...source,
                onSelect({ item, navigator }) {
                    navigator.navigate({
                        itemUrl: `${SEARCH_BASE_PATH}${queryParamsToStr({ q: item.id, resultType: SearchResultType.ALL })}`,
                    } as any)
                },
            }
        },
    })

// The delimiters @algolia/autocomplete-js's Highlight component expects in
// `_highlightResult` values (see parseAlgoliaHitHighlight). We ask Typesense
// to emit them directly so the component works unchanged.
const AA_HIGHLIGHT_PRE_TAG = "__aa-highlight__"
const AA_HIGHLIGHT_POST_TAG = "__/aa-highlight__"

/**
 * Runs a keyword-only Typesense search shaped for autocomplete and maps the
 * hits into autocomplete-js items.
 *
 * Deliberately no `vector_query`: hybrid search would call the remote OpenAI
 * embedder on every keystroke (slow and costly), and keyword-only search
 * keeps `prefix` matching available, which is exactly what search-as-you-type
 * needs (Typesense doesn't support prefix search with remote embedders).
 * Keyword-only also sidesteps the group_by + vector bug worked around in
 * queries.ts, so we can use native `group_by` for deduplication here.
 */
async function searchForAutocompleteItems(options: {
    collection: string
    query: string
    queryBy: string
    perPage: number
    groupBy?: string
    filterBy?: string
    sortBy?: string
}): Promise<BaseItem[]> {
    const client = getTypesenseClient()
    const response = await client
        .collections<BaseItem>(options.collection)
        .documents()
        .search({
            q: options.query,
            query_by: options.queryBy,
            stopwords: "english",
            filter_by: options.filterBy,
            sort_by: options.sortBy,
            group_by: options.groupBy,
            group_limit: options.groupBy ? 1 : undefined,
            per_page: options.perPage,
            page: 1,
            highlight_full_fields: "title",
            highlight_start_tag: AA_HIGHLIGHT_PRE_TAG,
            highlight_end_tag: AA_HIGHLIGHT_POST_TAG,
        })

    const rawHits =
        response.hits ??
        response.grouped_hits?.flatMap((group) => group.hits ?? []) ??
        []

    return rawHits.slice(0, options.perPage).map((hit) => {
        const highlight = hit.highlight as
            | { title?: { value?: string; snippet?: string } }
            | undefined
        const highlightedTitle =
            highlight?.title?.value ??
            highlight?.title?.snippet ??
            (hit.document.title as string | undefined) ??
            ""
        return {
            ...hit.document,
            // The templates and URL builders key off this, mirroring the
            // property Algolia's autocomplete preset used to set.
            __autocomplete_indexName: options.collection,
            _highlightResult: { title: { value: highlightedTitle } },
        }
    })
}

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

// The slugs we index to search don't include grapher/, explorers/, or data-insights/ subdirectories
// Prepend them with this function when we need them
const prependSubdirectoryToItemUrl = (item: BaseItem): string => {
    const indexName = item.__autocomplete_indexName as string
    return match(indexName)
        .with(PAGES_INDEX, () => {
            return getCanonicalUrl(BAKED_BASE_URL, {
                slug: item.slug as string,
                content: {
                    type: item.type as OwidGdocType,
                },
            })
        })
        .with(CHARTS_INDEX, () => {
            return match(item.type as ChartRecordType)
                .with(ChartRecordType.ExplorerView, () => {
                    const url = new URL(
                        urljoin(
                            BAKED_BASE_URL,
                            EXPLORERS_ROUTE_FOLDER,
                            item.slug as string
                        )
                    )
                    const queryParams = new URLSearchParams(
                        item.queryParams as string
                    )
                    for (const [key, value] of queryParams) {
                        url.searchParams.set(key, value)
                    }
                    return url.toString()
                })
                .with(ChartRecordType.Chart, () => {
                    return urljoin(BAKED_GRAPHER_URL, item.slug as string)
                })
                .with(ChartRecordType.MultiDimView, () => {
                    const url = new URL(
                        urljoin(BAKED_GRAPHER_URL, item.slug as string)
                    )
                    const queryParams = new URLSearchParams(
                        item.queryParams as string
                    )
                    for (const [key, value] of queryParams) {
                        url.searchParams.set(key, value)
                    }
                    return url.toString()
                })
                .exhaustive()
        })
        .otherwise(() => {
            Sentry.captureMessage(`Unknown search collection: ${indexName}`, {
                level: "error",
            })
            return urljoin(BAKED_BASE_URL, item.slug as string)
        })
}

const FeaturedSearchesSource: AutocompleteSource<BaseItem> = {
    sourceId: "suggestedSearch",
    onSelect,
    getItemUrl,
    getItems() {
        return ["CO2", "Energy", "Education", "Poverty", "Democracy"].map(
            (term) => ({
                title: term,
                slug: `${SEARCH_BASE_PATH}${queryParamsToStr({ q: term, resultType: SearchResultType.ALL })}`,
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

const searchResultItemTemplate: AutocompleteSource<BaseItem>["templates"] = {
    item: ({ item, components }) => {
        const indexName = item.__autocomplete_indexName as string

        const { label: indexLabel, icon: indexIcon } = match(indexName)
            .with(CHARTS_INDEX, () => ({
                label:
                    item.type === ChartRecordType.ExplorerView
                        ? "Explorer"
                        : "Chart",
                icon: faLineChart,
            }))
            .with(PAGES_INDEX, () => {
                const { name, icon } = getPageTypeNameAndIcon(
                    item.type as OwidGdocType
                )
                return { label: name, icon }
            })
            .otherwise(() => {
                Sentry.captureMessage(
                    `Unknown search collection: ${indexName}`,
                    { level: "error" }
                )
                return { label: "Result", icon: faSearch }
            })

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
}

const makeSearchResultOnSelect =
    (searchSource?: string): AutocompleteSource<BaseItem>["onSelect"] =>
    ({ navigator, item, state }) => {
        const itemUrl = prependSubdirectoryToItemUrl(item)
        siteAnalytics.logInstantSearchClick({
            query: state.query,
            url: itemUrl,
            position: String(state.activeItemId),
            source: searchSource,
        })
        navigator.navigate({ itemUrl, item, state })
    }

const searchResultGetItemUrl: AutocompleteSource<BaseItem>["getItemUrl"] = ({
    item,
}) => prependSubdirectoryToItemUrl(item)

const createPagesSource = (
    searchSource?: string
): AutocompleteSource<BaseItem> => ({
    sourceId: "autocomplete",
    onSelect: makeSearchResultOnSelect(searchSource),
    getItemUrl: searchResultGetItemUrl,
    getItems({ query }) {
        return searchForAutocompleteItems({
            collection: PAGES_INDEX,
            query,
            queryBy: "title,excerpt,tags,authors,content",
            perPage: 2,
            // pages are indexed as multiple content chunks per slug
            groupBy: "slug",
            filterBy: `type:!=${OwidGdocType.Profile}`,
        })
    },
    templates: searchResultItemTemplate,
})

const createChartsSource = (
    searchSource?: string
): AutocompleteSource<BaseItem> => ({
    sourceId: "autocomplete-charts",
    onSelect: makeSearchResultOnSelect(searchSource),
    getItemUrl: searchResultGetItemUrl,
    getItems({ query }) {
        return searchForAutocompleteItems({
            collection: CHARTS_INDEX,
            query,
            queryBy: "title,slug,subtitle,variantName,tags",
            perPage: 3,
            // equivalent of Algolia's `distinct` on the charts index
            groupBy: "deduplicationId",
        })
    },
    templates: searchResultItemTemplate,
})

const createFiltersSource = (
    allTopics: string[],
    synonymMap: SynonymMap,
    searchSource?: string
): AutocompleteSource<BaseItem> => ({
    sourceId: "filters",
    onSelect({ navigator, item, state }) {
        const itemUrl = item.slug as string
        siteAnalytics.logInstantSearchClick({
            query: state.query,
            url: itemUrl,
            position: String(state.activeItemId),
            source: searchSource,
        })
        navigator.navigate({ itemUrl, item, state })
    },
    getItemUrl,
    getItems({ query }) {
        if (!query.trim()) return []

        const suggestions = suggestFiltersFromQuerySuffix(
            query,
            listedRegionsNames(),
            allTopics,
            [], // no selected filters in this context
            synonymMap
        )

        return (
            suggestions.suggestions
                // Suggestions must now be explicitly selected by the user
                // (opt-out by default). Pressing "enter" will search for the
                // current query directly, so we no longer need to include an
                // extra query suggestion here.
                .filter((filter) => filter.type !== FilterType.QUERY)
                .map((filter) => ({
                    filter,
                    unmatchedQuery: suggestions.unmatchedQuery,
                    slug: getItemUrlForFilter(
                        filter,
                        suggestions.unmatchedQuery
                    ),
                }))
        )
    },
    templates: {
        item: ({ item }) => {
            const filter = item.filter as Filter
            const unmatchedQuery = item.unmatchedQuery as string

            return (
                match(filter.type)
                    .with(FilterType.COUNTRY, () => (
                        <span className="autocomplete-item-contents">
                            <span className="autocomplete-item-contents__type-icon">
                                <FontAwesomeIcon icon={faSearch} />
                            </span>
                            <span className="autocomplete-item-contents__query autocomplete-item-contents__query--unmatched">
                                {unmatchedQuery} {filter.name.toLowerCase()}
                            </span>
                        </span>
                    ))
                    .with(FilterType.TOPIC, () => (
                        <span className="autocomplete-item-contents">
                            <span className="autocomplete-item-contents__type-icon">
                                <FontAwesomeIcon icon={faSearch} />
                            </span>
                            <SearchFilterPill
                                name={filter.name}
                                icon={getFilterIcon(filter)}
                            />
                        </span>
                    ))
                    // dataset filters are not suggested in autocomplete
                    .with(
                        FilterType.DATASET_PRODUCT,
                        FilterType.DATASET_NAMESPACE,
                        FilterType.DATASET_VERSION,
                        FilterType.DATASET_PRODUCER,
                        () => <></>
                    )
                    // query filters are filtered out in getItems
                    .with(FilterType.QUERY, () => <></>)
                    .exhaustive()
            )
        },
    },
})

/**
 * Creates a profile source that boosts the user's geolocated country
 * using Typesense's `_eval` optional filtering in `sort_by` (the equivalent
 * of Algolia's `optionalFilters`). This avoids running expensive
 * client-side country detection on every keystroke while still ensuring:
 * - "energy" → "Energy in Canada" (boosted by geolocation)
 * - "canada" → Canada profiles (matched on title)
 * - "energy france" → "Energy in France" (matched naturally)
 */
const createProfileSource = (
    countryName: string | undefined,
    searchSource?: string
): AutocompleteSource<BaseItem> => ({
    sourceId: "profiles",
    onSelect: makeSearchResultOnSelect(searchSource),
    getItemUrl: searchResultGetItemUrl,
    getItems({ query }) {
        return searchForAutocompleteItems({
            collection: PAGES_INDEX,
            query,
            queryBy: "title,excerpt,tags,authors,content",
            perPage: 1,
            groupBy: "slug",
            filterBy: `type:=${OwidGdocType.Profile}`,
            ...(countryName && {
                sortBy: `_eval(availableEntities:=\`${countryName}\`):desc,_text_match:desc`,
            }),
        })
    },
    templates: searchResultItemTemplate,
})

export function Autocomplete({
    onActivate,
    onClose,
    className,
    placeholder = DEFAULT_SEARCH_PLACEHOLDER,
    panelClassName,
    isPreviewing,
    // Optional id override. Defaults to "autocomplete" so existing call sites
    // (topnav, homepage) keep working. Pass a unique id when more than one
    // Autocomplete renders on the same page — the underlying library uses the
    // container element to scope click-outside / blur detection, and duplicate
    // ids prevent the panel from closing on outside clicks.
    id = "autocomplete",
    // Where this autocomplete is rendered (e.g. "topnav", "homepage",
    // "datapage"). Attached to instant-search-click analytics so we can tell
    // which search bar a click came from.
    searchSource,
}: {
    onActivate?: () => void
    onClose?: () => void
    className?: string
    placeholder?: string
    panelClassName?: string
    isPreviewing?: boolean
    id?: string
    searchSource: string
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const panelRootRef = useRef<Root | null>(null)
    const rootRef = useRef<HTMLElement | null>(null)
    const { data: topicTagGraph } = useTopicTagGraph({
        isPreviewing: Boolean(isPreviewing),
    })
    const { allTopics } = useTagGraphTopics(topicTagGraph)

    const synonymMap = useMemo(() => buildSynonymMap(), [])
    const recentSearchesPlugin = useMemo(() => buildRecentSearchesPlugin(), [])

    const [search, setSearch] = useState<AutocompleteApi<BaseItem> | null>(null)

    const userCountryNameRef = useRef<string | undefined>(undefined)
    useEffect(() => {
        void getUserCountryInformation().then((info) => {
            userCountryNameRef.current = info?.name
        })
    }, [])

    useEffect(() => {
        if (!containerRef.current) return

        const search = autocomplete({
            placeholder,
            // Setting the `enterKeyHint` fixes a bug on Samsung phones where
            // characters may be deleted when typing.
            // https://support.algolia.com/hc/en-us/articles/35765245191057-Why-are-characters-being-deleted-from-Autocomplete-when-typing-on-a-Samsung-device
            enterKeyHint: "search",
            detachedMediaQuery: DETACHED_MEDIA_QUERY,
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
            // Keep the panel open while typing even if there are no suggestions (would otherwise close by default)
            shouldPanelOpen({ state }) {
                if (state.query) return true
                return state.collections.some(
                    (collection) => collection.items.length > 0
                )
            },
            onSubmit({ state, navigator }) {
                if (!state.query) return
                navigator.navigate({
                    itemUrl: `${SEARCH_BASE_PATH}${queryParamsToStr({ q: state.query, resultType: SearchResultType.ALL })}`,
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
                    sources.push(
                        createFiltersSource(
                            allTopics,
                            synonymMap,
                            searchSource
                        ),
                        createProfileSource(
                            userCountryNameRef.current,
                            searchSource
                        ),
                        createPagesSource(searchSource),
                        createChartsSource(searchSource)
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
            input.dataset.testid = "autocomplete-input"
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
        panelClassName,
        containerRef,
        allTopics,
        synonymMap,
        recentSearchesPlugin,
        userCountryNameRef,
        searchSource,
    ])

    // Close the panel on outside click. We can't rely on autocomplete-js's
    // built-in blur detection when multiple Autocomplete instances are on the
    // same page (e.g. topnav + datapage search): the library wires its blur
    // handler via `window._listeners.mousedown = handler` (single-slot
    // assignment in @algolia/autocomplete-js setProperties.js), so the second
    // instance to mount overwrites the first's handler — and only the
    // last-mounted instance closes properly. The autocomplete-core source
    // even carries a `@TODO: support cases where there are multiple
    // Autocomplete instances` comment for this. addEventListener stacks
    // rather than overwriting, so a per-instance listener here works for any
    // number of instances.
    //
    // This only applies to the docked panel. In detached (mobile) mode the
    // library renders a full-screen modal portaled to document.body — outside
    // both containerRef and the panel root — and handles its own dismissal
    // (backdrop tap, cancel button). Running our handler there would treat a
    // tap on the modal's own input or buttons as an outside click and close it,
    // so we bail when the detached media query matches.
    useEffect(() => {
        if (!search) return

        const onDocMouseDown = (e: MouseEvent) => {
            if (window.matchMedia(DETACHED_MEDIA_QUERY).matches) return

            const target = e.target as Node | null
            if (!target) return
            const isInsideContainer =
                containerRef.current?.contains(target) ?? false
            const isInsidePanel = rootRef.current?.contains(target) ?? false
            if (!isInsideContainer && !isInsidePanel) {
                search.setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", onDocMouseDown)
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown)
        }
    }, [search])

    // Preserve the page scroll position across the detached (mobile) modal.
    // autocomplete-theme-classic locks the page with `body.aa-Detached {
    // height: 100vh; overflow: hidden }` while the modal is open, which clamps
    // the window scroll to 0 and never restores it on close — so closing the
    // modal jumps the page to the top. The library does no save/restore, and we
    // can't read the position in onStateChange because the class (and the
    // reset) is applied before our callback runs. So we track the page scroll
    // while the modal is closed and restore it once it closes again.
    useEffect(() => {
        if (!search) return

        let savedScrollY = window.scrollY
        let isModalOpen = document.body.classList.contains("aa-Detached")

        const onScroll = () => {
            if (!isModalOpen) savedScrollY = window.scrollY
        }

        // Key off the exact class that triggers the reset. The observer
        // callback (a microtask) runs before the clamp's async scroll event, so
        // isModalOpen is already true by the time the scroll-to-0 fires and we
        // don't overwrite the saved position.
        const observer = new MutationObserver(() => {
            const open = document.body.classList.contains("aa-Detached")
            if (open === isModalOpen) return
            isModalOpen = open
            if (!open) window.scrollTo(0, savedScrollY)
        })

        window.addEventListener("scroll", onScroll, { passive: true })
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["class"],
        })

        return () => {
            window.removeEventListener("scroll", onScroll)
            observer.disconnect()
        }
    }, [search])

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

    return <div className={className} ref={containerRef} id={id} />
}
