import {
    SearchState,
    Filter,
    SearchResultType,
    SearchUrlParam,
    FilterType,
} from "@ourworldindata/types"
import {
    deserializeSet,
    createTopicFilter,
    createCountryFilter,
    isValidResultType,
    serializeSet,
    getFilterNamesOfType,
} from "./searchUtils.js"

export const DEFAULT_SEARCH_STATE: SearchState = {
    query: "",
    filters: [],
    requireAllCountries: false,
    resultType: SearchResultType.DATA,
}

/**
 * Derives SearchState from URLSearchParams. Sanitizes parameters before using them.
 * If parameters are missing, defaults are used.
 */
export function searchParamsToState(
    searchParams: URLSearchParams,
    validRegions: Set<string>,
    validTopics: Set<string>
): SearchState {
    const topicsSet = deserializeSet(searchParams.get("topics")).intersection(
        validTopics
    )
    const countriesSet = deserializeSet(
        searchParams.get("countries")
    ).intersection(validRegions)

    const filters: Filter[] = [
        [...topicsSet].map((topic) => createTopicFilter(topic)),
        [...countriesSet].map((country) => createCountryFilter(country)),
    ].flat()

    const resultTypeParam = searchParams.get("resultType") ?? undefined

    return {
        query: searchParams.get("q") ?? DEFAULT_SEARCH_STATE.query,
        filters,
        requireAllCountries:
            searchParams.get("requireAllCountries") === "true" ||
            DEFAULT_SEARCH_STATE.requireAllCountries,
        resultType: isValidResultType(resultTypeParam)
            ? resultTypeParam
            : DEFAULT_SEARCH_STATE.resultType,
    }
}

/**
 * Converts SearchState to URLSearchParams, only including non-default values.
 */
export function stateToSearchParams(state: SearchState): URLSearchParams {
    const params = new URLSearchParams()

    if (state.query) {
        params.set(SearchUrlParam.QUERY, state.query)
    }

    const topics = serializeSet(
        getFilterNamesOfType(state.filters, FilterType.TOPIC)
    )
    if (topics) {
        params.set(SearchUrlParam.TOPIC, topics)
    }

    const countries = serializeSet(
        getFilterNamesOfType(state.filters, FilterType.COUNTRY)
    )
    if (countries) {
        params.set(SearchUrlParam.COUNTRY, countries)
    }

    if (state.requireAllCountries) {
        params.set(SearchUrlParam.REQUIRE_ALL_COUNTRIES, "true")
    }

    // Only include resultType if not the default
    if (state.resultType !== DEFAULT_SEARCH_STATE.resultType) {
        params.set(SearchUrlParam.RESULT_TYPE, state.resultType)
    }

    return params
}

/**
 * Checks if URL params need sanitization (i.e., contain invalid values that
 * were filtered out during parsing).
 */
export function urlNeedsSanitization(
    searchParams: URLSearchParams,
    state: SearchState
): boolean {
    const sanitizedParams = stateToSearchParams(state)
    return searchParams.toString() !== sanitizedParams.toString()
}
