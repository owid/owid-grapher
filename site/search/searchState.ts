import { Url } from "@ourworldindata/utils"
import { match } from "ts-pattern"
import {
    SearchState,
    SearchAction,
    Filter,
    FilterType,
    SearchResultType,
    SearchUrlParam,
} from "./searchTypes.js"
import {
    createCountryFilter,
    createTopicFilter,
    deserializeSet,
    getFilterNamesOfType,
    isValidResultType,
    serializeSet,
} from "./searchUtils.js"

function handleAddFilter(state: SearchState, filter: Filter): SearchState {
    const filterExists = state.filters.some(
        (f) => f.type === filter.type && f.name === filter.name
    )
    const newFilters = filterExists ? state.filters : [...state.filters, filter]
    return {
        ...state,
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
            query: query.trim(),
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
        .with({ type: "removeTopic" }, ({ topic }) =>
            handleRemoveFilter(state, createTopicFilter(topic))
        )
        .with({ type: "setTopic" }, ({ topic }) => {
            // Remove all existing topic filters and add the new one
            const newFilters = state.filters.filter(
                (f) => f.type !== FilterType.TOPIC
            )
            return {
                ...state,
                filters: [...newFilters, createTopicFilter(topic)],
            }
        })
        .with({ type: "toggleRequireAllCountries" }, () => ({
            ...state,
            requireAllCountries: !state.requireAllCountries,
        }))
        .with({ type: "setState" }, ({ state }) => state)
        .with({ type: "reset" }, () => ({
            ...state,
            ...getInitialSearchState(),
        }))
        .with({ type: "setResultType" }, ({ resultType }) => ({
            ...state,
            resultType,
        }))
        .exhaustive()
}

export function createActions(dispatch: (action: SearchAction) => void) {
    // prettier-ignore
    return {
        addCountry: (country: string) => dispatch({ type: "addCountry", country }),
        setTopic: (topic: string) => dispatch({ type: "setTopic", topic }),
        removeCountry: (country: string) => dispatch({ type: "removeCountry", country }),
        removeTopic: (topic: string) => dispatch({ type: "removeTopic", topic }),
        addFilter: (filter: Filter) => dispatch({ type: "addFilter", filter }),
        removeFilter: (filter: Filter) => dispatch({ type: "removeFilter", filter }),
        setQuery: (query: string) => dispatch({ type: "setQuery", query }),
        setState: (state: SearchState) => dispatch({ type: "setState", state }),
        toggleRequireAllCountries: () => dispatch({ type: "toggleRequireAllCountries" }),
        setResultType: (resultType: SearchResultType) => dispatch({ type: "setResultType", resultType }),
        reset: () => dispatch({ type: "reset" }),
    }
}

export function getInitialSearchState(): SearchState {
    // Always return the default state to prevent hydration mismatches. The
    // actual URL state will be applied client-side after hydration using the
    // useSyncUrlToState hook.
    return {
        query: "",
        filters: [],
        requireAllCountries: false,
        resultType: SearchResultType.DATA,
    }
}

export function urlToSearchState(url: Url): SearchState {
    const topicsSet = deserializeSet(url.queryParams.topics)
    const countriesSet = deserializeSet(url.queryParams.countries)

    const filters: Filter[] = [
        [...topicsSet].map((topic) => createTopicFilter(topic)),
        [...countriesSet].map((country) => createCountryFilter(country)),
    ].flat()

    const queryParams = url.queryParams as Record<
        SearchUrlParam,
        string | undefined
    >

    return {
        query: queryParams.q || "",
        filters,
        requireAllCountries: url.queryParams.requireAllCountries === "true",
        resultType: isValidResultType(url.queryParams.resultType)
            ? url.queryParams.resultType
            : SearchResultType.DATA,
    }
}

export function searchStateToUrl(state: SearchState) {
    let url = Url.fromURL(
        typeof window === "undefined" ? "" : window.location.href
    )

    const params: Record<SearchUrlParam, string | undefined> = {
        [SearchUrlParam.QUERY]: state.query || undefined,
        [SearchUrlParam.TOPIC]: serializeSet(
            getFilterNamesOfType(state.filters, FilterType.TOPIC)
        ),
        [SearchUrlParam.COUNTRY]: serializeSet(
            getFilterNamesOfType(state.filters, FilterType.COUNTRY)
        ),
        [SearchUrlParam.REQUIRE_ALL_COUNTRIES]: state.requireAllCountries
            ? "true"
            : undefined,
        [SearchUrlParam.RESULT_TYPE]:
            state.resultType !== SearchResultType.DATA
                ? state.resultType
                : undefined,
    }

    Object.entries(params).forEach(([key, value]) => {
        url = url.updateQueryParams({ [key]: value })
    })

    return url.fullUrl
}
