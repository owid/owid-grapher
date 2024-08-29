import { Url } from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { deserializeSet, serializeSet } from "./DataCatalogUtils.js"

export type DataCatalogState = Readonly<{
    query: string
    topics: Set<string>
    selectedCountryNames: Set<string>
    requireAllCountries: boolean
    page: number
}>

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

type ResetStateAction = {
    type: "resetState"
    state: DataCatalogState
}

type SetPageAction = {
    type: "setPage"
    page: number
}

export type DataCatalogAction =
    | AddTopicAction
    | RemoveTopicAction
    | SetQueryAction
    | AddCountryAction
    | RemoveCountryAction
    | ToggleRequireAllCountriesAction
    | ResetStateAction
    | SetPageAction

export function dataCatalogReducer(
    state: DataCatalogState,
    action: DataCatalogAction
): DataCatalogState {
    return match(action)
        .with({ type: "setQuery" }, ({ query }) => ({
            ...state,
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
                topics: newTopics,
            }
        })
        .with({ type: "addCountry" }, ({ country }) => ({
            ...state,
            selectedCountryNames: new Set(state.selectedCountryNames).add(
                country
            ),
        }))
        .with({ type: "removeCountry" }, ({ country }) => {
            const newCountries = new Set(state.selectedCountryNames)
            newCountries.delete(country)
            return {
                ...state,
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
        .with({ type: "resetState" }, ({ state }) => state)
        .exhaustive()
}

export function createActions(dispatch: (action: DataCatalogAction) => void) {
    return {
        setQuery: (query: string) => dispatch({ type: "setQuery", query }),
        addTopic: (topic: string) => dispatch({ type: "addTopic", topic }),
        removeTopic: (topic: string) =>
            dispatch({ type: "removeTopic", topic }),
        addCountry: (country: string) =>
            dispatch({ type: "addCountry", country }),
        removeCountry: (country: string) =>
            dispatch({ type: "removeCountry", country }),
        toggleRequireAllCountries: () =>
            dispatch({ type: "toggleRequireAllCountries" }),
        setPage: (page: number) => dispatch({ type: "setPage", page }),
        resetState: (state: DataCatalogState) =>
            dispatch({ type: "resetState", state }),
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
        }

    const url = Url.fromURL(window.location.href)
    return urlToDataCatalogState(url)
}

export function urlToDataCatalogState(url: Url): DataCatalogState {
    return {
        query: url.queryParams.q || "",
        topics: deserializeSet(url.queryParams.topics),
        selectedCountryNames: deserializeSet(url.queryParams.countries),
        requireAllCountries: url.queryParams.requireAllCountries === "true",
        page: url.queryParams.page ? parseInt(url.queryParams.page) - 1 : 0,
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
    }

    Object.entries(params).forEach(([key, value]) => {
        url = url.updateQueryParams({ [key]: value })
    })

    return url.fullUrl
}
