import { Url } from "@ourworldindata/utils"
import { match } from "ts-pattern"
import {
    deserializeSet,
    getFiltersOfType,
    serializeSet,
} from "./DataCatalogUtils.js"

// Define component IDs as an enum
export enum CatalogComponentId {
    APPLIED_FILTERS = "appliedFilters",
    TOPICS_REFINEMENT = "topicsRefinement",
    DATA_INSIGHTS = "dataInsights",
    HIGHLIGHTS = "highlights",
    RESULTS = "results",
    CONTENT_TYPE_TOGGLE = "contentTypeToggle",
    FUZZY_MATCHER = "fuzzyMatcher",
}

// Define component style options
export enum CatalogComponentStyle {
    GRID = "grid",
    TABLE = "table",
}

// Define search relaxation options
export enum SearchRelaxationMode {
    NONE = "none",
    FIRST_WORDS = "firstWords",
    LAST_WORDS = "lastWords",
    ALL_OPTIONAL = "allOptional",
}

// Define content type filter options
export enum CatalogContentType {
    ALL = "all",
    DATA = "data",
    WRITING = "writing",
}

export enum QueryType {
    PREFIX_ALL = "prefixAll",
    PREFIX_LAST = "prefixLast",
    PREFIX_NONE = "prefixNone",
}

// Define filter types
export enum CatalogFilterType {
    COUNTRY = "country",
    TOPIC = "topic",
}

export type CatalogFilter = {
    type: CatalogFilterType
    name: string
}

export type DataCatalogState = Readonly<{
    query: string
    filters: CatalogFilter[] // Array of filter objects
    requireAllCountries: boolean
    page: number
    componentOrder: CatalogComponentId[]
    componentVisibility: Record<CatalogComponentId, boolean>
    componentCount: Record<CatalogComponentId, number>
    componentStyles: Record<CatalogComponentId, CatalogComponentStyle>
    isStickyHeader: boolean
    searchRelaxationMode: SearchRelaxationMode
    contentTypeFilter: CatalogContentType
    queryType: QueryType
    typoTolerance: boolean
    minQueryLength: number
}>

export interface ComponentConfig {
    id: CatalogComponentId
    name: string
    visible: boolean
    maxItems?: number
    style?: CatalogComponentStyle
    type?: CatalogContentType[]
}

// Define available components with default order
export const DEFAULT_COMPONENTS: ComponentConfig[] = [
    {
        id: CatalogComponentId.APPLIED_FILTERS,
        name: "Applied Filters",
        visible: false,
    },
    {
        id: CatalogComponentId.CONTENT_TYPE_TOGGLE,
        name: "Content Type Filter",
        visible: true,
    },
    {
        id: CatalogComponentId.FUZZY_MATCHER,
        name: "Fuzzy Matcher",
        visible: false,
    },
    {
        id: CatalogComponentId.TOPICS_REFINEMENT,
        name: "Topics",
        visible: true,
    },
    {
        id: CatalogComponentId.DATA_INSIGHTS,
        name: "Data Insights",
        visible: true,
        maxItems: 2,
        type: [CatalogContentType.DATA, CatalogContentType.WRITING],
    },
    {
        id: CatalogComponentId.HIGHLIGHTS,
        name: "Highlights",
        visible: true,
        maxItems: 2,
        type: [CatalogContentType.DATA],
    },
    {
        id: CatalogComponentId.RESULTS,
        name: "Results",
        visible: true,
        style: CatalogComponentStyle.GRID,
        type: [CatalogContentType.DATA],
    },
]

type AddFilterAction = {
    type: "addFilter"
    filterType: CatalogFilterType
    name: string
}

type RemoveFilterAction = {
    type: "removeFilter"
    filterType: CatalogFilterType
    name: string
}

type SetQueryAction = {
    type: "setQuery"
    query: string
}

type ToggleRequireAllCountriesAction = {
    type: "toggleRequireAllCountries"
}

type SetStateAction = {
    type: "setState"
    state: DataCatalogState
}

type SetPageAction = {
    type: "setPage"
    page: number
}

type UpdateComponentOrderAction = {
    type: "updateComponentOrder"
    payload: CatalogComponentId[]
}

type ToggleComponentVisibilityAction = {
    type: "toggleComponentVisibility"
    payload: CatalogComponentId
}

type SetComponentCountAction = {
    type: "setComponentCount"
    payload: {
        componentId: CatalogComponentId
        count: number
    }
}

type SetComponentStyleAction = {
    type: "setComponentStyle"
    payload: {
        componentId: CatalogComponentId
        style: CatalogComponentStyle
    }
}

type ToggleStickyHeaderAction = {
    type: "toggleStickyHeader"
}

type SetSearchRelaxationModeAction = {
    type: "setSearchRelaxationMode"
    payload: SearchRelaxationMode
}

type SetContentTypeFilterAction = {
    type: "setContentTypeFilter"
    payload: CatalogContentType
}

type SetQueryTypeAction = {
    type: "setQueryType"
    payload: QueryType
}

type SetTypoToleranceAction = {
    type: "setTypoTolerance"
    payload: boolean
}

type SetMinQueryLengthAction = {
    type: "setMinQueryLength"
    payload: number
}

export type DataCatalogAction =
    | AddFilterAction
    | RemoveFilterAction
    | SetPageAction
    | SetQueryAction
    | SetStateAction
    | ToggleRequireAllCountriesAction
    | UpdateComponentOrderAction
    | ToggleComponentVisibilityAction
    | SetComponentCountAction
    | SetComponentStyleAction
    | ToggleStickyHeaderAction
    | SetSearchRelaxationModeAction
    | SetContentTypeFilterAction
    | SetQueryTypeAction
    | SetTypoToleranceAction
    | SetMinQueryLengthAction

export function dataCatalogReducer(
    state: DataCatalogState,
    action: DataCatalogAction
): DataCatalogState {
    return match(action)
        .with({ type: "setQuery" }, ({ query }) => ({
            ...state,
            page: 0,
            query,
        }))
        .with({ type: "addFilter" }, ({ filterType, name }) => {
            // Check if filter already exists
            const filterExists = state.filters.some(
                (filter) => filter.type === filterType && filter.name === name
            )

            // Only add if it doesn't exist
            const newFilters = filterExists
                ? state.filters
                : [...state.filters, { type: filterType, name }]

            return {
                ...state,
                page: 0,
                filters: newFilters,
            }
        })
        .with({ type: "removeFilter" }, ({ filterType, name }) => {
            const newFilters = state.filters.filter(
                (filter) =>
                    !(filter.type === filterType && filter.name === name)
            )

            // Check if we're removing the last country filter
            const hasCountryFilters = newFilters.some(
                (filter) => filter.type === CatalogFilterType.COUNTRY
            )

            return {
                ...state,
                page: 0,
                requireAllCountries: hasCountryFilters
                    ? state.requireAllCountries
                    : false,
                filters: newFilters,
            }
        })
        .with({ type: "toggleRequireAllCountries" }, () => ({
            ...state,
            requireAllCountries: !state.requireAllCountries,
        }))
        .with({ type: "setPage" }, ({ page }) => ({
            ...state,
            page,
        }))
        .with({ type: "setState" }, ({ state }) => state)
        .with({ type: "updateComponentOrder" }, ({ payload }) => ({
            ...state,
            componentOrder: payload,
        }))
        .with({ type: "toggleComponentVisibility" }, ({ payload }) => ({
            ...state,
            componentVisibility: {
                ...state.componentVisibility,
                [payload]: !state.componentVisibility[payload],
            },
        }))
        .with({ type: "setComponentCount" }, ({ payload }) => ({
            ...state,
            componentCount: {
                ...state.componentCount,
                [payload.componentId]: payload.count,
            },
        }))
        .with({ type: "setComponentStyle" }, ({ payload }) => ({
            ...state,
            componentStyles: {
                ...state.componentStyles,
                [payload.componentId]: payload.style,
            },
        }))
        .with({ type: "toggleStickyHeader" }, () => ({
            ...state,
            isStickyHeader: !state.isStickyHeader,
        }))
        .with({ type: "setSearchRelaxationMode" }, ({ payload }) => ({
            ...state,
            searchRelaxationMode: payload,
        }))
        .with({ type: "setContentTypeFilter" }, ({ payload }) => ({
            ...state,
            contentTypeFilter: payload,
        }))
        .with({ type: "setQueryType" }, ({ payload }) => ({
            ...state,
            queryType: payload,
        }))
        .with({ type: "setTypoTolerance" }, ({ payload }) => ({
            ...state,
            typoTolerance: payload,
        }))
        .with({ type: "setMinQueryLength" }, ({ payload }) => ({
            ...state,
            minQueryLength: payload,
        }))
        .exhaustive()
}

export function createActions(dispatch: (action: DataCatalogAction) => void) {
    // prettier-ignore
    return {
        addFilter: (filterType: CatalogFilterType, name: string) =>
            dispatch({ type: "addFilter", filterType, name }),
        removeFilter: (filterType: CatalogFilterType, name: string) =>
            dispatch({ type: "removeFilter", filterType, name }),

        // Convenience methods for backwards compatibility
        addTopic: (topic: string) =>
            dispatch({ type: "addFilter", filterType: CatalogFilterType.TOPIC, name: topic }),
        removeTopic: (topic: string) =>
            dispatch({ type: "removeFilter", filterType: CatalogFilterType.TOPIC, name: topic }),
        addCountry: (country: string) =>
            dispatch({ type: "addFilter", filterType: CatalogFilterType.COUNTRY, name: country }),
        removeCountry: (country: string) =>
            dispatch({ type: "removeFilter", filterType: CatalogFilterType.COUNTRY, name: country }),

        setPage: (page: number) => dispatch({ type: "setPage", page }),
        setQuery: (query: string) => dispatch({ type: "setQuery", query }),
        setState: (state: DataCatalogState) => dispatch({ type: "setState", state }),
        toggleRequireAllCountries: () => dispatch({ type: "toggleRequireAllCountries" }),
        updateComponentOrder: (componentOrder: CatalogComponentId[]) => dispatch({ type: "updateComponentOrder", payload: componentOrder }),
        toggleComponentVisibility: (componentId: CatalogComponentId) => dispatch({ type: "toggleComponentVisibility", payload: componentId }),
        setComponentCount: (componentId: CatalogComponentId, count: number) =>
            dispatch({ type: "setComponentCount", payload: { componentId, count } }),
        setComponentStyle: (componentId: CatalogComponentId, style: CatalogComponentStyle) =>
            dispatch({ type: "setComponentStyle", payload: { componentId, style } }),
        toggleStickyHeader: () => dispatch({ type: "toggleStickyHeader" }),
        setSearchRelaxationMode: (mode: SearchRelaxationMode) => dispatch({ type: "setSearchRelaxationMode", payload: mode }),
        setContentTypeFilter: (filter: CatalogContentType) => dispatch({ type: "setContentTypeFilter", payload: filter }),
        setQueryType: (type: QueryType) => dispatch({ type: "setQueryType", payload: type }),
        setTypoTolerance: (enabled: boolean) => dispatch({ type: "setTypoTolerance", payload: enabled }),
        setMinQueryLength: (length: number) => dispatch({ type: "setMinQueryLength", payload: length }),
    }
}

// Helper functions to extract default component properties
function getDefaultComponentOrder(): CatalogComponentId[] {
    return DEFAULT_COMPONENTS.map((c) => c.id)
}

function getDefaultComponentVisibility(): Record<CatalogComponentId, boolean> {
    return Object.fromEntries(
        DEFAULT_COMPONENTS.map((c) => [c.id, c.visible])
    ) as Record<CatalogComponentId, boolean>
}

function getDefaultComponentCount(): Record<CatalogComponentId, number> {
    return Object.fromEntries(
        DEFAULT_COMPONENTS.map((c) => [c.id, c.maxItems || 0])
    ) as Record<CatalogComponentId, number>
}

function getDefaultComponentStyles(): Record<
    CatalogComponentId,
    CatalogComponentStyle
> {
    return Object.fromEntries(
        DEFAULT_COMPONENTS.map((c) => [
            c.id,
            c.style || CatalogComponentStyle.GRID,
        ])
    ) as Record<CatalogComponentId, CatalogComponentStyle>
}

const getDefaultCatalogState = (): DataCatalogState => ({
    query: "",
    filters: [],
    requireAllCountries: false,
    page: 0,
    componentOrder: getDefaultComponentOrder(),
    componentVisibility: getDefaultComponentVisibility(),
    componentCount: getDefaultComponentCount(),
    componentStyles: getDefaultComponentStyles(),
    isStickyHeader: true,
    searchRelaxationMode: SearchRelaxationMode.ALL_OPTIONAL,
    contentTypeFilter: CatalogContentType.ALL,
    queryType: QueryType.PREFIX_ALL,
    typoTolerance: true,
    minQueryLength: 2,
})

export function getInitialDatacatalogState(): DataCatalogState {
    if (typeof window === "undefined") return getDefaultCatalogState()

    const url = Url.fromURL(window.location.href)
    const state = urlToDataCatalogState(url)

    return state
}

export function urlToDataCatalogState(url: Url): DataCatalogState {
    // Start with the default state
    const state = { ...getDefaultCatalogState() }

    // Override with URL parameters
    if (url.queryParams.q) state.query = url.queryParams.q

    // Handle topics as filters
    if (url.queryParams.topics) {
        const topicNames = deserializeSet(url.queryParams.topics)
        for (const name of topicNames) {
            state.filters.push({
                type: CatalogFilterType.TOPIC,
                name,
            })
        }
    }

    // Handle countries as filters
    if (url.queryParams.countries) {
        const countryNames = deserializeSet(url.queryParams.countries)
        for (const name of countryNames) {
            state.filters.push({
                type: CatalogFilterType.COUNTRY,
                name,
            })
        }
    }

    if (url.queryParams.requireAllCountries)
        state.requireAllCountries =
            url.queryParams.requireAllCountries === "true"
    if (url.queryParams.page) state.page = parseInt(url.queryParams.page) - 1
    if (url.queryParams.stickyHeader)
        state.isStickyHeader = url.queryParams.stickyHeader === "true"
    if (url.queryParams.searchRelaxation)
        state.searchRelaxationMode = url.queryParams
            .searchRelaxation as SearchRelaxationMode
    if (url.queryParams.contentType)
        state.contentTypeFilter = url.queryParams
            .contentType as CatalogContentType
    if (url.queryParams.queryType)
        state.queryType = url.queryParams.queryType as QueryType
    if (url.queryParams.typoTolerance)
        state.typoTolerance = url.queryParams.typoTolerance === "true"
    if (url.queryParams.minQueryLength)
        state.minQueryLength = parseInt(url.queryParams.minQueryLength)

    // Check for specific component counts in URL
    if (url.queryParams.insights) {
        state.componentCount = {
            ...state.componentCount,
            [CatalogComponentId.DATA_INSIGHTS]: parseInt(
                url.queryParams.insights
            ),
        }
    }

    // Check for specific component styles in URL
    if (
        url.queryParams.resultsStyle &&
        (url.queryParams.resultsStyle === CatalogComponentStyle.GRID ||
            url.queryParams.resultsStyle === CatalogComponentStyle.TABLE)
    ) {
        state.componentStyles = {
            ...state.componentStyles,
            [CatalogComponentId.RESULTS]: url.queryParams
                .resultsStyle as CatalogComponentStyle,
        }
    }

    return state
}

export function dataCatalogStateToUrl(state: DataCatalogState) {
    let url = Url.fromURL(
        typeof window === "undefined" ? "" : window.location.href
    )

    const defaultCatalogState = getDefaultCatalogState()

    const defaultInsightsCount =
        defaultCatalogState.componentCount[CatalogComponentId.DATA_INSIGHTS]
    const defaultResultsStyle =
        defaultCatalogState.componentStyles[CatalogComponentId.RESULTS]

    const params = {
        q: state.query || undefined,
        topics: serializeSet(getFiltersOfType(state, CatalogFilterType.TOPIC)),
        countries: serializeSet(
            getFiltersOfType(state, CatalogFilterType.COUNTRY)
        ),
        requireAllCountries: state.requireAllCountries ? "true" : undefined,
        page: state.page > 0 ? (state.page + 1).toString() : undefined,
        insights:
            state.componentCount[CatalogComponentId.DATA_INSIGHTS] !==
            defaultInsightsCount
                ? state.componentCount[
                      CatalogComponentId.DATA_INSIGHTS
                  ].toString()
                : undefined,
        resultsStyle:
            state.componentStyles[CatalogComponentId.RESULTS] !==
            defaultResultsStyle
                ? state.componentStyles[CatalogComponentId.RESULTS]
                : undefined,
        stickyHeader: state.isStickyHeader ? undefined : "false", // Only include if false (default is true)
        searchRelaxation:
            state.searchRelaxationMode !==
            defaultCatalogState.searchRelaxationMode
                ? state.searchRelaxationMode
                : undefined,
        contentType:
            state.contentTypeFilter !== defaultCatalogState.contentTypeFilter
                ? state.contentTypeFilter
                : undefined,
        queryType:
            state.queryType !== defaultCatalogState.queryType
                ? state.queryType
                : undefined,
        typoTolerance:
            state.typoTolerance !== defaultCatalogState.typoTolerance
                ? state.typoTolerance.toString()
                : undefined,
        minQueryLength:
            state.minQueryLength !== defaultCatalogState.minQueryLength
                ? state.minQueryLength.toString()
                : undefined,
    }

    Object.entries(params).forEach(([key, value]) => {
        url = url.updateQueryParams({ [key]: value })
    })

    return url.fullUrl
}
