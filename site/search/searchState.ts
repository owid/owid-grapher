import { Url } from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { deserializeSet, serializeSet } from "./searchUtils.js"
import { SearchState, SearchAction } from "./searchTypes.js"

export function searchReducer(
    state: SearchState,
    action: SearchAction
): SearchState {
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
        .exhaustive()
}

export function createActions(dispatch: (action: SearchAction) => void) {
    // prettier-ignore
    return {
        addCountry: (country: string) => dispatch({ type: "addCountry", country }),
        addTopic: (topic: string) => dispatch({ type: "addTopic", topic }),
        removeCountry: (country: string) => dispatch({ type: "removeCountry", country }),
        removeTopic: (topic: string) => dispatch({ type: "removeTopic", topic }),
        setPage: (page: number) => dispatch({ type: "setPage", page }),
        setQuery: (query: string) => dispatch({ type: "setQuery", query }),
        setState: (state: SearchState) => dispatch({ type: "setState", state }),
        toggleRequireAllCountries: () => dispatch({ type: "toggleRequireAllCountries" }),
    }
}

export function getInitialSearchState(): SearchState {
    if (typeof window === "undefined")
        return {
            query: "",
            topics: new Set(),
            selectedCountryNames: new Set(),
            requireAllCountries: false,
            page: 0,
        }

    const url = Url.fromURL(window.location.href)
    return urlToSearchState(url)
}

export function urlToSearchState(url: Url): SearchState {
    return {
        query: url.queryParams.q || "",
        topics: deserializeSet(url.queryParams.topics),
        selectedCountryNames: deserializeSet(url.queryParams.countries),
        requireAllCountries: url.queryParams.requireAllCountries === "true",
        page: url.queryParams.page ? parseInt(url.queryParams.page) - 1 : 0,
    }
}

export function searchStateToUrl(state: SearchState) {
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
