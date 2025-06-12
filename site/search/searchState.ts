import { Url } from "@ourworldindata/utils"
import { match } from "ts-pattern"
import {
    SearchState,
    SearchAction,
    Filter,
    FilterType,
    ResultType,
} from "./searchTypes.js"
import {
    createCountryFilter,
    createTopicFilter,
    deserializeSet,
    getFilterNamesOfType,
    isValidResultType,
    serializeSet,
} from "./searchUtils.js"

// Helper functions to handle filter actions
function handleAddFilter(state: SearchState, filter: Filter): SearchState {
    const filterExists = state.filters.some(
        (f) => f.type === filter.type && f.name === filter.name
    )
    const newFilters = filterExists ? state.filters : [...state.filters, filter]
    return {
        ...state,
        page: 0,
        filters: newFilters,
    }
}

function handleRemoveFilter(state: SearchState, filter: Filter): SearchState {
    const newFilters = state.filters.filter(
        (f) => !(f.type === filter.type && f.name === filter.name)
    )
    // Check if we're removing the last country filter
    const hasCountryFilters = newFilters.some(
        (filter) => filter.type === FilterType.COUNTRY
    )

    return {
        ...state,
        page: 0,
        requireAllCountries: hasCountryFilters
            ? state.requireAllCountries
            : false,
        filters: newFilters,
    }
}

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
        .with({ type: "addFilter" }, ({ filter }) =>
            handleAddFilter(state, filter)
        )
        .with({ type: "removeFilter" }, ({ filter }) =>
            handleRemoveFilter(state, filter)
        )
        .with({ type: "addCountry" }, ({ country }) =>
            handleAddFilter(state, createCountryFilter(country))
        )
        .with({ type: "removeCountry" }, ({ country }) =>
            handleRemoveFilter(state, createCountryFilter(country))
        )
        .with({ type: "addTopic" }, ({ topic }) =>
            handleAddFilter(state, createTopicFilter(topic))
        )
        .with({ type: "removeTopic" }, ({ topic }) =>
            handleRemoveFilter(state, createTopicFilter(topic))
        )
        .with({ type: "toggleRequireAllCountries" }, () => ({
            ...state,
            requireAllCountries: !state.requireAllCountries,
        }))
        .with({ type: "setPage" }, ({ page }) => ({
            ...state,
            page,
        }))
        .with({ type: "setState" }, ({ state }) => state)
        .with({ type: "reset" }, () => ({
            ...state,
            ...getInitialSearchState(),
        }))
        .with({ type: "setResultType" }, ({ resultType }) => ({
            ...state,
            page: 0,
            resultType,
        }))
        .exhaustive()
}

export function createActions(dispatch: (action: SearchAction) => void) {
    // prettier-ignore
    return {
        addCountry: (country: string) => dispatch({ type: "addCountry", country }),
        addTopic: (topic: string) => dispatch({ type: "addTopic", topic }),
        removeCountry: (country: string) => dispatch({ type: "removeCountry", country }),
        removeTopic: (topic: string) => dispatch({ type: "removeTopic", topic }),
        addFilter: (filter: Filter) => dispatch({ type: "addFilter", filter }),
        removeFilter: (filter: Filter) => dispatch({ type: "removeFilter", filter }),
        setPage: (page: number) => dispatch({ type: "setPage", page }),
        setQuery: (query: string) => dispatch({ type: "setQuery", query }),
        setState: (state: SearchState) => dispatch({ type: "setState", state }),
        toggleRequireAllCountries: () => dispatch({ type: "toggleRequireAllCountries" }),
        setResultType: (resultType: ResultType) => dispatch({ type: "setResultType", resultType }),
        reset: () => dispatch({ type: "reset" }),
    }
}

export function getInitialSearchState(): SearchState {
    // Always return the default state to prevent hydration mismatches
    // The actual URL state will be applied client-side after hydration
    return {
        query: "",
        filters: [],
        requireAllCountries: false,
        page: 0,
        resultType: ResultType.ALL,
    }
}

export function urlToSearchState(url: Url): SearchState {
    const topicsSet = deserializeSet(url.queryParams.topics)
    const countriesSet = deserializeSet(url.queryParams.countries)

    const filters: Filter[] = [
        [...topicsSet].map((topic) => createTopicFilter(topic)),
        [...countriesSet].map((country) => createCountryFilter(country)),
    ].flat()

    return {
        query: url.queryParams.q || "",
        filters,
        requireAllCountries: url.queryParams.requireAllCountries === "true",
        page: url.queryParams.page ? parseInt(url.queryParams.page) - 1 : 0,
        resultType: isValidResultType(url.queryParams.resultType)
            ? url.queryParams.resultType
            : ResultType.ALL,
    }
}

export function searchStateToUrl(state: SearchState) {
    let url = Url.fromURL(
        typeof window === "undefined" ? "" : window.location.href
    )

    const params = {
        q: state.query || undefined,
        topics: serializeSet(
            getFilterNamesOfType(state.filters, FilterType.TOPIC)
        ),
        countries: serializeSet(
            getFilterNamesOfType(state.filters, FilterType.COUNTRY)
        ),
        requireAllCountries: state.requireAllCountries ? "true" : undefined,
        page: state.page > 0 ? (state.page + 1).toString() : undefined,
        resultType:
            state.resultType !== ResultType.ALL ? state.resultType : undefined,
    }

    Object.entries(params).forEach(([key, value]) => {
        url = url.updateQueryParams({ [key]: value })
    })

    return url.fullUrl
}
