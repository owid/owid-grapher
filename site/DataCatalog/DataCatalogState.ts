import { Url } from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { deserializeSet, serializeSet } from "./DataCatalogUtils.js"

// Define component IDs as an enum
export enum CatalogComponentId {
    APPLIED_FILTERS = "appliedFilters",
    TOPICS_REFINEMENT = "topicsRefinement",
    DATA_INSIGHTS = "dataInsights",
    RESULTS = "results",
}

export type DataCatalogState = Readonly<{
    query: string
    topics: Set<string>
    selectedCountryNames: Set<string>
    requireAllCountries: boolean
    page: number
    componentOrder: CatalogComponentId[]
    componentVisibility: Record<CatalogComponentId, boolean>
    insightsToShow: number
}>

export interface ComponentConfig {
    id: CatalogComponentId
    name: string
    visible: boolean
}

// Define available components with default order
export const DEFAULT_COMPONENTS: ComponentConfig[] = [
    {
        id: CatalogComponentId.APPLIED_FILTERS,
        name: "Applied Filters",
        visible: true,
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
    },
    { id: CatalogComponentId.RESULTS, name: "Results", visible: true },
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

type SetInsightsToShowAction = {
    type: "setInsightsToShow"
    count: number
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
    | SetInsightsToShowAction

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
        .with({ type: "setInsightsToShow" }, ({ count }) => ({
            ...state,
            insightsToShow: count,
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
        setInsightsToShow: (count: number) => dispatch({ type: "setInsightsToShow", count }),
    }
}

export function getInitialDatacatalogState(): DataCatalogState {
    if (typeof window === "undefined")
        return {
            query: "",
            topics: new Set(),
            selectedCountryNames: new Set(),
            requireAllCountries: false,
            page: 0,
            componentOrder: DEFAULT_COMPONENTS.map((c) => c.id),
            componentVisibility: Object.fromEntries(
                DEFAULT_COMPONENTS.map((c) => [c.id, c.visible])
            ) as Record<CatalogComponentId, boolean>,
            insightsToShow: 2,
        }

    const url = Url.fromURL(window.location.href)
    const state = urlToDataCatalogState(url)

    // Add component configuration with defaults
    return {
        ...state,
        componentOrder: DEFAULT_COMPONENTS.map((c) => c.id),
        componentVisibility: Object.fromEntries(
            DEFAULT_COMPONENTS.map((c) => [c.id, c.visible])
        ) as Record<CatalogComponentId, boolean>,
        insightsToShow: 2,
    }
}

export function urlToDataCatalogState(url: Url): DataCatalogState {
    return {
        query: url.queryParams.q || "",
        topics: deserializeSet(url.queryParams.topics),
        selectedCountryNames: deserializeSet(url.queryParams.countries),
        requireAllCountries: url.queryParams.requireAllCountries === "true",
        page: url.queryParams.page ? parseInt(url.queryParams.page) - 1 : 0,
        componentOrder: DEFAULT_COMPONENTS.map((c) => c.id),
        componentVisibility: Object.fromEntries(
            DEFAULT_COMPONENTS.map((c) => [c.id, c.visible])
        ) as Record<CatalogComponentId, boolean>,
        insightsToShow: url.queryParams.insights
            ? parseInt(url.queryParams.insights)
            : 2,
    }
}

export function dataCatalogStateToUrl(state: DataCatalogState) {
    let url = Url.fromURL(
        typeof window === "undefined" ? "" : window.location.href
    )

    const params = {
        q: state.query || undefined,
        topics: serializeSet(state.topics),
        countries: serializeSet(state.selectedCountryNames),
        requireAllCountries: state.requireAllCountries ? "true" : undefined,
        page: state.page > 0 ? (state.page + 1).toString() : undefined,
        insights:
            state.insightsToShow !== 2
                ? state.insightsToShow.toString()
                : undefined,
    }

    Object.entries(params).forEach(([key, value]) => {
        url = url.updateQueryParams({ [key]: value })
    })

    return url.fullUrl
}
