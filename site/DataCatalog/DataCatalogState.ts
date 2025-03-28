import { Url } from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { deserializeSet, serializeSet } from "./DataCatalogUtils.js"

// Define component IDs as an enum
export enum CatalogComponentId {
    APPLIED_FILTERS = "appliedFilters",
    TOPICS_REFINEMENT = "topicsRefinement",
    DATA_INSIGHTS = "dataInsights",
    HIGHLIGHTS = "highlights",
    RESULTS = "results",
}

// Define component style options
export enum CatalogComponentStyle {
    GRID = "grid",
    TABLE = "table",
}

export type DataCatalogState = Readonly<{
    query: string
    topics: Set<string>
    selectedCountryNames: Set<string>
    requireAllCountries: boolean
    page: number
    componentOrder: CatalogComponentId[]
    componentVisibility: Record<CatalogComponentId, boolean>
    componentCount: Record<CatalogComponentId, number>
    componentStyles: Record<CatalogComponentId, CatalogComponentStyle>
}>

export interface ComponentConfig {
    id: CatalogComponentId
    name: string
    visible: boolean
    maxItems?: number
    style?: CatalogComponentStyle
}

// Define available components with default order
export const DEFAULT_COMPONENTS: ComponentConfig[] = [
    {
        id: CatalogComponentId.APPLIED_FILTERS,
        name: "Applied Filters",
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
    },
    {
        id: CatalogComponentId.HIGHLIGHTS,
        name: "Highlights",
        visible: true,
        maxItems: 2,
    },
    {
        id: CatalogComponentId.RESULTS,
        name: "Results",
        visible: true,
        style: CatalogComponentStyle.GRID,
    },
]

type AddTopicAction = {
    type: "addTopic"
    topic: string
}

type RemoveTopicAction = {
    type: "removeTopic"
    topic: string
}

type SetQueryAction = {
    type: "setQuery"
    query: string
}

type AddCountryAction = {
    type: "addCountry"
    country: string
}

type RemoveCountryAction = {
    type: "removeCountry"
    country: string
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

export type DataCatalogAction =
    | AddCountryAction
    | AddTopicAction
    | RemoveCountryAction
    | RemoveTopicAction
    | SetPageAction
    | SetQueryAction
    | SetStateAction
    | ToggleRequireAllCountriesAction
    | UpdateComponentOrderAction
    | ToggleComponentVisibilityAction
    | SetComponentCountAction
    | SetComponentStyleAction

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
        .with({ type: "addTopic" }, ({ topic }) => ({
            ...state,
            page: 0,
            topics: new Set(state.topics).add(topic),
        }))
        .with({ type: "removeTopic" }, ({ topic }) => {
            const newTopics = new Set(state.topics)
            newTopics.delete(topic)
            return {
                ...state,
                page: 0,
                topics: newTopics,
            }
        })
        .with({ type: "addCountry" }, ({ country }) => ({
            ...state,
            page: 0,
            selectedCountryNames: new Set(state.selectedCountryNames).add(
                country
            ),
        }))
        .with({ type: "removeCountry" }, ({ country }) => {
            const newCountries = new Set(state.selectedCountryNames)
            newCountries.delete(country)
            return {
                ...state,
                page: 0,
                requireAllCountries:
                    newCountries.size === 0 ? false : state.requireAllCountries,
                selectedCountryNames: newCountries,
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
        .exhaustive()
}

export function createActions(dispatch: (action: DataCatalogAction) => void) {
    // prettier-ignore
    return {
        addCountry: (country: string) => dispatch({ type: "addCountry", country }),
        addTopic: (topic: string) => dispatch({ type: "addTopic", topic }),
        removeCountry: (country: string) => dispatch({ type: "removeCountry", country }),
        removeTopic: (topic: string) => dispatch({ type: "removeTopic", topic }),
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

export function getInitialDatacatalogState(): DataCatalogState {
    if (typeof window === "undefined")
        return {
            query: "",
            topics: new Set(),
            selectedCountryNames: new Set(),
            requireAllCountries: false,
            page: 0,
            componentOrder: getDefaultComponentOrder(),
            componentVisibility: getDefaultComponentVisibility(),
            componentCount: getDefaultComponentCount(),
            componentStyles: getDefaultComponentStyles(),
        }

    const url = Url.fromURL(window.location.href)
    const state = urlToDataCatalogState(url)

    return state
}

export function urlToDataCatalogState(url: Url): DataCatalogState {
    // Start with default component properties
    const defaultComponentCount = getDefaultComponentCount()
    const defaultComponentStyles = getDefaultComponentStyles()

    // Check for specific component counts in URL
    if (url.queryParams.insights) {
        defaultComponentCount[CatalogComponentId.DATA_INSIGHTS] = parseInt(
            url.queryParams.insights
        )
    }

    // Check for specific component styles in URL
    if (
        url.queryParams.resultsStyle &&
        (url.queryParams.resultsStyle === CatalogComponentStyle.GRID ||
            url.queryParams.resultsStyle === CatalogComponentStyle.TABLE)
    ) {
        defaultComponentStyles[CatalogComponentId.RESULTS] = url.queryParams
            .resultsStyle as CatalogComponentStyle
    }

    return {
        query: url.queryParams.q || "",
        topics: deserializeSet(url.queryParams.topics),
        selectedCountryNames: deserializeSet(url.queryParams.countries),
        requireAllCountries: url.queryParams.requireAllCountries === "true",
        page: url.queryParams.page ? parseInt(url.queryParams.page) - 1 : 0,
        componentOrder: getDefaultComponentOrder(),
        componentVisibility: getDefaultComponentVisibility(),
        componentCount: defaultComponentCount,
        componentStyles: defaultComponentStyles,
    }
}

export function dataCatalogStateToUrl(state: DataCatalogState) {
    let url = Url.fromURL(
        typeof window === "undefined" ? "" : window.location.href
    )

    const defaultInsightsCount =
        DEFAULT_COMPONENTS.find(
            (c) => c.id === CatalogComponentId.DATA_INSIGHTS
        )?.maxItems || 2

    const defaultResultsStyle =
        DEFAULT_COMPONENTS.find((c) => c.id === CatalogComponentId.RESULTS)
            ?.style || CatalogComponentStyle.GRID

    const params = {
        q: state.query || undefined,
        topics: serializeSet(state.topics),
        countries: serializeSet(state.selectedCountryNames),
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
    }

    Object.entries(params).forEach(([key, value]) => {
        url = url.updateQueryParams({ [key]: value })
    })

    return url.fullUrl
}
