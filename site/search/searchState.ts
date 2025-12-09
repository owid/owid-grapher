import {
    ScoredFilterPositioned,
    SearchState,
    Filter,
    SearchResultType,
    SearchUrlParam,
    FilterType,
    SynonymMap,
    SearchActions,
} from "@ourworldindata/types"
import {
    deserializeSet,
    createTopicFilter,
    createCountryFilter,
    isValidResultType,
    serializeSet,
    getFilterNamesOfType,
    extractFiltersFromQuery,
    splitIntoWords,
    removeMatchedWordsWithStopWords,
    createFilter,
} from "./searchUtils.js"
import { useMemo, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom-v5-compat"
import { intersectionOfSets } from "@ourworldindata/utils"

export const DEFAULT_SEARCH_STATE: SearchState = {
    query: "",
    filters: [],
    requireAllCountries: false,
    resultType: SearchResultType.DATA,
}

/**
 * Hook that manages search state via URL search params.
 *
 * Key design principle: URL is the source of truth. State is derived
 * synchronously from URL params, including automatic filter detection.
 */

export function useSearchParamsState(
    eligibleRegionNames: string[],
    eligibleTopicsAndAreas: string[],
    synonymMap: SynonymMap
): {
    state: SearchState
    actions: SearchActions
} {
    const [searchParams, setSearchParams] = useSearchParams()

    // Derive state from URL, applying automatic filters as part of derivation.
    // This ensures state consistency when URLs are manually edited.
    const state = useMemo(() => {
        const rawState = searchParamsToState(
            searchParams,
            eligibleRegionNames,
            eligibleTopicsAndAreas
        )
        return applyAutomaticFilters(rawState, eligibleRegionNames, synonymMap)
    }, [searchParams, eligibleRegionNames, eligibleTopicsAndAreas, synonymMap])

    // Sanitize URL in the following cases:
    // - automatic filters have been applied
    // - query params are invalid (e.g. "countryes=France")
    // - query params contain invalid values (e.g. "countries=Franc")
    useEffect(() => {
        if (urlNeedsSanitization(searchParams, state)) {
            // replace current entry in browser history to keep it clean.
            setSearchParams(stateToSearchParams(state), { replace: true })
        }
    }, [searchParams, state, setSearchParams])

    const updateParams = useCallback(
        (
            updater: (current: SearchState) => SearchState,
            options?: { replace?: boolean }
        ) => {
            const newState = updater(state)
            // Update URL atomically by applying auto-filters before setting search
            // params. This ensures the unicity of browser history entries, query execution
            // and analytics event per user action.
            const stateWithAutoFilters = applyAutomaticFilters(
                newState,
                eligibleRegionNames,
                synonymMap
            )
            setSearchParams(stateToSearchParams(stateWithAutoFilters), options)
        },
        [setSearchParams, state, eligibleRegionNames, synonymMap]
    )

    const actions = useMemo<SearchActions>(
        () => ({
            setQuery: (query: string) => {
                updateParams((s) => ({ ...s, query: query.trim() }))
            },

            addCountry: (country: string) => {
                updateParams((s) => {
                    const exists = s.filters.some(
                        (f) =>
                            f.type === FilterType.COUNTRY && f.name === country
                    )
                    if (exists) return s
                    return {
                        ...s,
                        filters: [...s.filters, createCountryFilter(country)],
                    }
                })
            },

            // Compound action to ensure a single entry in the browser history.
            addCountryAndSetQuery: (country: string, query: string) => {
                updateParams((s) => {
                    const exists = s.filters.some(
                        (f) =>
                            f.type === FilterType.COUNTRY && f.name === country
                    )
                    return {
                        ...s,
                        query: query.trim(),
                        filters: exists
                            ? s.filters
                            : [...s.filters, createCountryFilter(country)],
                    }
                })
            },

            removeCountry: (country: string) => {
                updateParams((s) => {
                    const newFilters = s.filters.filter(
                        (f) =>
                            !(
                                f.type === FilterType.COUNTRY &&
                                f.name === country
                            )
                    )
                    const hasCountryFilters = newFilters.some(
                        (f) => f.type === FilterType.COUNTRY
                    )
                    return {
                        ...s,
                        filters: newFilters,
                        requireAllCountries: hasCountryFilters
                            ? s.requireAllCountries
                            : false,
                    }
                })
            },

            setTopic: (topic: string) => {
                updateParams((s) => {
                    const newFilters = s.filters.filter(
                        (f) => f.type !== FilterType.TOPIC
                    )
                    return {
                        ...s,
                        filters: [...newFilters, createTopicFilter(topic)],
                    }
                })
            },

            // Compound action to ensure a single entry in the browser history.
            setTopicAndClearQuery: (topic: string) => {
                updateParams((s) => {
                    const newFilters = s.filters.filter(
                        (f) => f.type !== FilterType.TOPIC
                    )
                    return {
                        ...s,
                        query: "",
                        filters: [...newFilters, createTopicFilter(topic)],
                    }
                })
            },

            removeTopic: (topic: string) => {
                updateParams((s) => ({
                    ...s,
                    filters: s.filters.filter(
                        (f) =>
                            !(f.type === FilterType.TOPIC && f.name === topic)
                    ),
                }))
            },

            addFilter: (filter: Filter) => {
                updateParams((s) => {
                    const exists = s.filters.some(
                        (f) => f.type === filter.type && f.name === filter.name
                    )
                    if (exists) return s
                    return { ...s, filters: [...s.filters, filter] }
                })
            },

            removeFilter: (filter: Filter) => {
                updateParams((s) => {
                    const newFilters = s.filters.filter(
                        (f) =>
                            !(f.type === filter.type && f.name === filter.name)
                    )
                    const hasCountryFilters = newFilters.some(
                        (f) => f.type === FilterType.COUNTRY
                    )
                    return {
                        ...s,
                        filters: newFilters,
                        requireAllCountries:
                            filter.type === FilterType.COUNTRY &&
                            !hasCountryFilters
                                ? false
                                : s.requireAllCountries,
                    }
                })
            },

            toggleRequireAllCountries: () => {
                updateParams((s) => ({
                    ...s,
                    requireAllCountries: !s.requireAllCountries,
                }))
            },

            setResultType: (resultType: SearchResultType) => {
                updateParams((s) => ({ ...s, resultType }))
            },

            replaceQueryWithFilter: (filter: ScoredFilterPositioned) => {
                updateParams((s) => replaceQueryWordsWithFilters(s, [filter]), {
                    replace: true,
                })
            },

            reset: () => {
                setSearchParams(new URLSearchParams())
            },
        }),
        [updateParams, setSearchParams]
    )

    return { state, actions }
}

/**
 * Derives SearchState from URLSearchParams. Sanitizes parameters before using
 * them. If parameters are missing, defaults are used.
 */
export function searchParamsToState(
    searchParams: URLSearchParams,
    eligibleRegionNames: string[],
    eligibleTopicsAndAreas: string[]
): SearchState {
    const topicsSet = intersectionOfSets([
        deserializeSet(searchParams.get("topics")),
        new Set(eligibleTopicsAndAreas),
    ])
    const countriesSet = intersectionOfSets([
        deserializeSet(searchParams.get("countries")),
        new Set(eligibleRegionNames),
    ])

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

/**
 * Core logic for replacing query words with filters.
 * Used by both automatic filter detection and manual filter suggestions.
 */
export function replaceQueryWordsWithFilters(
    state: SearchState,
    filtersWithPositions: ScoredFilterPositioned[]
): SearchState {
    if (filtersWithPositions.length === 0) return state

    // Collect all positions that need to be removed from the query
    const allPositions = filtersWithPositions.flatMap((f) => f.positions)

    // Remove matched words from query
    const queryWords = splitIntoWords(state.query)
    const newQuery = removeMatchedWordsWithStopWords(queryWords, allPositions)

    // Add new filters (avoiding duplicates)
    const existingFilterKeys = new Set(
        state.filters.map((f) => `${f.type}:${f.name}`)
    )
    const newFilters = filtersWithPositions
        .filter((f) => !existingFilterKeys.has(`${f.type}:${f.name}`))
        // do not include positions in the state, which would break assumptions
        // for deep equality in analytics logging when automatic filters are applied
        .map((f) => createFilter(f.type)(f.name))

    return {
        ...state,
        query: newQuery.trim(),
        filters: [...state.filters, ...newFilters],
    }
}

/**
 * Applies automatic country filters detected in the query.
 * Extracts exact country name matches from the query and adds them as filters,
 * removing the matched words from the query string.
 */
export function applyAutomaticFilters(
    state: SearchState,
    allRegionNames: string[],
    synonymMap: SynonymMap
): SearchState {
    if (!state.query) return state

    const matches = extractFiltersFromQuery(
        state.query,
        allRegionNames,
        [], // do not suggest topics for auto-detection
        state.filters,
        { threshold: 1, limit: 1 }, // only exact matches
        synonymMap
    )

    // Only auto-apply exact country matches
    const countryMatches = matches.filter(
        (match) => match.type === FilterType.COUNTRY
    )

    return replaceQueryWordsWithFilters(state, countryMatches)
}
