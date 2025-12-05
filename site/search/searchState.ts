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
    serializeSet,
    getFilterNamesOfType,
} from "./searchUtils.js"
import { z } from "zod"

/** Default search state - used as single source of truth for defaults */
export const DEFAULT_SEARCH_STATE: SearchState = {
    query: "",
    filters: [],
    requireAllCountries: false,
    resultType: SearchResultType.DATA,
}

// Creates a schema that deserializes a string to a Set, then intersects with
// valid values and returns an array
const buildValidListSchema = (validValues: Set<string>) =>
    z
        .string()
        .optional()
        .transform(deserializeSet)
        .transform((set) => set.intersection(validValues))
        .transform((set) => [...set])

/**
 * Creates a Zod schema for validating search URL parameters.
 * Countries and topics are validated against the provided sets.
 */
export const createSearchParamsSchema = (
    validCountries: Set<string>,
    validTopics: Set<string>
) =>
    z.object({
        [SearchUrlParam.QUERY]: z.string().default(DEFAULT_SEARCH_STATE.query), // defaults to empty string
        [SearchUrlParam.COUNTRY]: buildValidListSchema(validCountries), // defaults to empty array
        [SearchUrlParam.TOPIC]: buildValidListSchema(validTopics), // defaults to empty array
        [SearchUrlParam.REQUIRE_ALL_COUNTRIES]: z
            .string()
            .optional()
            .transform((val) => val === "true"), // defaults to false
        [SearchUrlParam.RESULT_TYPE]: z
            .enum(SearchResultType)
            .catch(SearchResultType.DATA), // defaults to SearchResultType.DATA
    } satisfies Record<SearchUrlParam, z.ZodType>)

// Helper to extract all params from URLSearchParams using SearchUrlParam enum
const extractSearchParams = (searchParams: URLSearchParams) =>
    Object.fromEntries(
        Object.values(SearchUrlParam).map((key) => [
            key,
            searchParams.get(key) ?? undefined,
        ])
    ) as Record<SearchUrlParam, string | undefined>

/**
 * Derives SearchState from URLSearchParams using Zod validation.
 * Countries and topics are validated against the provided sets.
 * Invalid values are filtered out silently.
 */
export function searchParamsToState(
    searchParams: URLSearchParams,
    validCountries: Set<string>,
    validTopics: Set<string>
): SearchState {
    const schema = createSearchParamsSchema(validCountries, validTopics)
    const result = schema.safeParse(extractSearchParams(searchParams))

    if (!result.success) {
        // all params should handled failure individiually in the schema, so
        // this should never happen
        return DEFAULT_SEARCH_STATE
    }

    const parsed = result.data

    const filters: Filter[] = [
        parsed.topics.map(createTopicFilter),
        parsed.countries.map(createCountryFilter),
    ].flat()

    return {
        query: parsed.q,
        filters,
        requireAllCountries: parsed.requireAllCountries,
        resultType: parsed.resultType,
    }
}

/**
 * Converts SearchState to URLSearchParams, only including non-default values.
 */
export function stateToSearchParams(state: SearchState): URLSearchParams {
    const params = new URLSearchParams()

    if (state.query !== DEFAULT_SEARCH_STATE.query) {
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

    if (
        state.requireAllCountries !== DEFAULT_SEARCH_STATE.requireAllCountries
    ) {
        params.set(
            SearchUrlParam.REQUIRE_ALL_COUNTRIES,
            String(state.requireAllCountries)
        )
    }

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
