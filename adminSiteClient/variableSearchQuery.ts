import { useCallback } from "react"
import { useHistory, useLocation } from "react-router-dom"
import { parseIntOrUndefined } from "@ourworldindata/utils"
import {
    parseSearchQuery,
    searchFieldOf,
    SearchFieldHelp,
} from "../adminShared/variableSearch.js"
import {
    buildRegexFromSearchWord,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../adminShared/search.js"

// The search grammar and its fields are shared with the server, in
// `adminShared/variableSearch.ts`. What lives here is only what the browser
// needs on top of that: the box, the URL, and knowing which words to highlight.

export interface VariableSearchBox {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    autoFocus?: boolean
    /** The `field:value` terms, listed in a help popover. */
    fields?: readonly SearchFieldHelp[]
}

// A regex search over ~800k indicators takes seconds, so don't fire one off on
// every keystroke
export const SEARCH_DEBOUNCE_MS = 300

export type SearchHighlighter = ReturnType<
    typeof highlightFunctionForSearchWords
>

/**
 * Whether the query names a dataset. Its indicators are then paged through
 * rather than grouped: grouping a single group would cap it at five again.
 */
export function namesOneDataset(query: string): boolean {
    return parseSearchQuery(query).some((term) => {
        // `-dataset:wdi` leaves nearly everything, which is still worth
        // grouping
        if (term.negate) return false
        // Only what the server turns into a filter: a value still being typed,
        // or a `dataset-id:` it can't read as a number, narrows nothing, and
        // the flat list would then rank every indicator
        if (term.field === "dataset") return term.value !== ""
        if (term.field === "dataset-id")
            return parseIntOrUndefined(term.value) !== undefined
        return false
    })
}

export function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`
}

export interface CatalogPathParts {
    namespace: string
    version: string
    dataset: string
    table: string
    shortName: string | undefined
}

/** `grapher/who/2026-05-22/gho/gho#x` without the `grapher/` every path has. */
export function parseCatalogPath(catalogPath: string): CatalogPathParts {
    const [path, shortName] = catalogPath
        .replace(/^grapher\//, "")
        .split("#") as [string, string | undefined]
    const [namespace = "", version = "", dataset = "", ...rest] =
        path.split("/")
    return { namespace, version, dataset, table: rest.join("/"), shortName }
}

/** The table segment of an indicator's catalog path, if it has one. */
export function catalogTableOf(
    catalogPath: string | null | undefined
): string | undefined {
    if (!catalogPath) return undefined
    return parseCatalogPath(catalogPath).table || undefined
}

export interface TableCount {
    table: string
    /** How many indicators the table holds. */
    count: number
}

/**
 * The ETL tables a dataset's indicators are spread over, by name, each with
 * how many indicators it holds. An indicator without a catalog path — a
 * legacy, non-ETL one — belongs to no table and is left out.
 */
export function countIndicatorsByTable(
    variables: { catalogPath?: string | null }[]
): TableCount[] {
    const counts = new Map<string, number>()
    for (const variable of variables) {
        const table = catalogTableOf(variable.catalogPath)
        if (table) counts.set(table, (counts.get(table) ?? 0) + 1)
    }
    return [...counts]
        .map(([table, count]) => ({ table, count }))
        .sort((a, b) => a.table.localeCompare(b.table))
}

/**
 * The `field:value` terms of a query, exclusions included, as typed. A field
 * that is still being typed has no value yet, and an unknown one is searched
 * as text, so neither counts.
 */
export function fieldedTerms(query: string): string[] {
    return parseSearchQuery(query)
        .filter((term) => term.value && searchFieldOf(term))
        .map((term) => term.raw)
}

/** The query with the given terms taken out. */
export function withoutTerms(query: string, drop: string[]): string {
    return (
        parseSearchQuery(query)
            .map((term) => term.raw)
            .filter((raw) => !drop.includes(raw))
            // a phrase has to go back in quotes to stay one term
            .map((raw) => (/\s/.test(raw) ? `"${raw}"` : raw))
            .join(" ")
    )
}

/**
 * What to highlight in the results: plain words, and the values of string
 * fields. An unknown `field:` is searched as text by the server, so it is
 * highlighted as typed.
 */
export function searchWordsToHighlight(query: string): SearchWord[] {
    return parseSearchQuery(query).flatMap((term): SearchWord[] => {
        if (term.negate) return []
        const field = searchFieldOf(term)
        if (field && field.type !== "string") return []
        const word = field ? term.value : term.raw
        if (!word) return []
        return [{ regex: buildRegexFromSearchWord(word), word, exclude: false }]
    })
}

const SEARCH_PARAM = "search"

/** A link to the same page searching for `value`, as kept by `useSearchQueryParam`. */
export function searchHref(value: string): string {
    return `?${new URLSearchParams({ [SEARCH_PARAM]: value })}`
}

/**
 * Keeps the search in the URL, so a filtered list can be bookmarked, shared
 * and restored by the back button.
 */
export function useSearchQueryParam(): [
    string,
    (value: string, options?: { push?: boolean }) => void,
] {
    const location = useLocation()
    const history = useHistory()
    const value = new URLSearchParams(location.search).get(SEARCH_PARAM) ?? ""

    const setValue = useCallback(
        (nextValue: string, options?: { push?: boolean }) => {
            const params = new URLSearchParams(location.search)
            if (nextValue) params.set(SEARCH_PARAM, nextValue)
            else params.delete(SEARCH_PARAM)
            const query = params.toString()
            // `location.pathname` is relative to the router's basename, unlike
            // `window.location.pathname`, which would double up the /admin prefix
            const next = {
                pathname: location.pathname,
                search: query ? `?${query}` : "",
            }
            // Typing replaces, or every keystroke would be a step back; a link
            // that narrows the search is a step, so Back returns from it
            if (options?.push) history.push(next)
            else history.replace(next)
        },
        [history, location.pathname, location.search]
    )

    return [value, setValue]
}
