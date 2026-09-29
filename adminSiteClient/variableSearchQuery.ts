import { useCallback } from "react"
import { useHistory, useLocation } from "react-router-dom"
import {
    buildRegexFromSearchWord,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../adminShared/search.js"

// The indicator search is parsed on the server, by `buildWhereClauses` in
// `db/model/Variable.ts`. What lives here is only what the browser needs on top
// of that: the box, its help, the URL, and knowing which words to highlight —
// all following the server's grammar of space-separated terms, `-exclusions`
// and `field:value`.

export interface SearchFieldHelp {
    name: string
    /** Only string fields have their value highlighted in the results. */
    type: "string" | "number" | "date"
    description: string
}

export interface VariableSearchBox {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    autoFocus?: boolean
    /** Width of the input. Defaults to 500px. */
    width?: number | string
    /** The `field:value` terms, listed in a help popover. */
    fields?: SearchFieldHelp[]
    /** Whether the search is kept in the page URL, as the help then says. */
    inUrl?: boolean
}

export type SearchHighlighter = ReturnType<
    typeof highlightFunctionForSearchWords
>

/** The fields `buildWhereClauses` understands, for the help and highlighting. */
export const INDICATOR_SEARCH_FIELDS: SearchFieldHelp[] = [
    { name: "name", type: "string", description: "Indicator name (regex)" },
    { name: "path", type: "string", description: "Catalog path (regex)" },
    {
        name: "namespace",
        type: "string",
        description: "Namespace, the first segment of the path",
    },
    { name: "version", type: "string", description: "Version segment" },
    { name: "dataset", type: "string", description: "Dataset segment" },
    {
        name: "datasetid",
        type: "number",
        description: "Exactly one dataset, by id",
    },
    { name: "table", type: "string", description: "Table segment" },
    { name: "short", type: "string", description: "Indicator short name" },
    {
        name: "datasetname",
        type: "string",
        description: "The dataset's title",
    },
    { name: "before", type: "date", description: "Version before this date" },
    { name: "after", type: "date", description: "Version after this date" },
    { name: "is", type: "string", description: "public or private" },
]

/**
 * Whether the query names a dataset. Its indicators are then paged through
 * rather than grouped: grouping a single group would cap it at five again.
 */
export function namesOneDataset(query: string): boolean {
    // `-dataset:wdi` leaves nearly everything, which is still worth grouping
    return terms(query).some((term) => /^dataset(id)?:/.test(term))
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

const FIELDED_TERM = /^([a-zA-Z][\w-]*):(.+)$/

/**
 * The query's terms, split the way the server splits them: on spaces, except
 * inside double quotes, which keep a phrase together and are dropped.
 */
function terms(query: string): string[] {
    const found: string[] = []
    let current = ""
    let inQuotes = false
    for (const char of query) {
        if (char === '"') inQuotes = !inQuotes
        else if (/\s/.test(char) && !inQuotes) {
            if (current) found.push(current)
            current = ""
        } else current += char
    }
    if (current) found.push(current)
    return found
}

/** The `field:value` terms of a query, exclusions included. */
export function fieldedTerms(query: string): string[] {
    return terms(query).filter((term) =>
        FIELDED_TERM.test(term.replace(/^-/, ""))
    )
}

/** The query with the given terms taken out. */
export function withoutTerms(query: string, drop: string[]): string {
    return (
        terms(query)
            .filter((term) => !drop.includes(term))
            // a phrase has to go back in quotes to stay one term
            .map((term) => (/\s/.test(term) ? `"${term}"` : term))
            .join(" ")
    )
}

/**
 * What to highlight in the results: plain words, and the values of string
 * fields. An unknown `field:` is searched as text by the server, so it is
 * highlighted as typed.
 */
export function searchWordsToHighlight(
    query: string,
    fields: readonly SearchFieldHelp[]
): SearchWord[] {
    const fieldsByName = new Map(fields.map((field) => [field.name, field]))
    return terms(query).flatMap((term): SearchWord[] => {
        if (term.startsWith("-")) return []
        const fielded = FIELDED_TERM.exec(term)
        const field = fielded && fieldsByName.get(fielded[1].toLowerCase())
        if (field && field.type !== "string") return []
        const word = field ? fielded[2] : term
        return [{ regex: buildRegexFromSearchWord(word), word, exclude: false }]
    })
}

/**
 * Keeps the search in the URL, so a filtered list can be bookmarked, shared
 * and restored by the back button.
 */
export function useSearchQueryParam(
    key: string = "search"
): [string, (value: string, options?: { push?: boolean }) => void] {
    const location = useLocation()
    const history = useHistory()
    const value = new URLSearchParams(location.search).get(key) ?? ""

    const setValue = useCallback(
        (nextValue: string, options?: { push?: boolean }) => {
            const params = new URLSearchParams(location.search)
            if (nextValue) params.set(key, nextValue)
            else params.delete(key)
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
        [history, key, location.pathname, location.search]
    )

    return [value, setValue]
}
