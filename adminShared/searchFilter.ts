import { buildRegexFromSearchWord, SearchWord } from "./search.js"

/**
 * A fielded search over a list of items, shared by the admin's list pages.
 *
 * The query is a list of space-separated terms, all of which must match:
 *
 *     measles                     a word, matched against the free-text fields
 *     "measles cases"             a phrase
 *     -measles                    excluded: rows matching it are dropped
 *     namespace:who               matched against one field only
 *     tag:"Global Health"         a field, with a phrase
 *     charts:>5  updated:>2024    numbers and dates take a comparison
 *     updated:2024-03             a date without one matches that prefix
 *
 * A `field:` the page doesn't declare is treated as ordinary text, so pasting
 * a URL or a catalog path into the box searches for it rather than erroring.
 */

export type SearchFieldType = "string" | "number" | "boolean" | "date"

export type SearchFieldValue =
    | string
    | number
    | boolean
    | Date
    | null
    | undefined
    | readonly (string | number | null | undefined)[]

export interface SearchField<T> {
    /** How the field is written in a query, e.g. `tag` in `tag:Energy`. */
    name: string
    type: SearchFieldType
    /** Shown in the search help popover. */
    description: string
    get: (item: T) => SearchFieldValue
    /**
     * Whether a bare word searches this field. Defaults to true for string
     * fields, false for the others — `2024` shouldn't have to mean a year.
     */
    freeText?: boolean
}

export type SearchOperator = ">" | ">=" | "<" | "<=" | "="

export interface SearchToken {
    /** The field named in the query, lowercased; absent for free text. */
    field?: string
    operator?: SearchOperator
    value: string
    exclude: boolean
    /** The token as typed, used when `field` turns out to be unknown. */
    raw: string
}

/** Splits on whitespace, keeping quoted runs together and dropping the quotes. */
function splitTokens(query: string): string[] {
    const tokens: string[] = []
    let current = ""
    let inQuotes = false
    for (const char of query) {
        if (char === '"') {
            inQuotes = !inQuotes
            continue
        }
        if (!inQuotes && /\s/.test(char)) {
            if (current) tokens.push(current)
            current = ""
            continue
        }
        current += char
    }
    if (current) tokens.push(current)
    return tokens
}

export function parseSearchQuery(query: string | undefined): SearchToken[] {
    if (!query?.trim()) return []

    return splitTokens(query).map((raw): SearchToken => {
        const exclude = raw.startsWith("-")
        const body = exclude ? raw.slice(1) : raw

        // A trailing colon is someone halfway through typing `field:value`;
        // search for the text so the results don't blank out mid-keystroke
        const partialField = /^([a-zA-Z][\w-]*):$/.exec(body)
        if (partialField) return { value: partialField[1], exclude, raw }

        const fieldMatch = /^([a-zA-Z][\w-]*):(.+)$/.exec(body)
        if (!fieldMatch) return { value: body, exclude, raw }

        const [, field, rest] = fieldMatch
        const operatorMatch = /^(>=|<=|>|<|=)(.+)$/.exec(rest)
        if (operatorMatch)
            return {
                field: field.toLowerCase(),
                operator: operatorMatch[1] as SearchOperator,
                value: operatorMatch[2],
                exclude,
                raw,
            }
        return { field: field.toLowerCase(), value: rest, exclude, raw }
    })
}

function toArray(value: SearchFieldValue): SearchFieldValue[] {
    return Array.isArray(value) ? value : [value]
}

function compare(
    left: number | string,
    right: number | string,
    operator: SearchOperator = "="
): boolean {
    switch (operator) {
        case ">":
            return left > right
        case ">=":
            return left >= right
        case "<":
            return left < right
        case "<=":
            return left <= right
        case "=":
            return left === right
    }
}

const TRUTHY = new Set(["true", "yes", "1"])
const FALSY = new Set(["false", "no", "0"])

function matchesValue(
    value: SearchFieldValue,
    type: SearchFieldType,
    token: SearchToken
): boolean {
    if (value === null || value === undefined) return false

    switch (type) {
        case "string":
            return buildRegexFromSearchWord(token.value).test(String(value))
        case "number": {
            const query = Number(token.value)
            if (Number.isNaN(query)) return false
            return compare(Number(value), query, token.operator)
        }
        case "boolean": {
            const query = TRUTHY.has(token.value.toLowerCase())
                ? true
                : FALSY.has(token.value.toLowerCase())
                  ? false
                  : undefined
            return query === undefined ? false : Boolean(value) === query
        }
        case "date": {
            const date = value instanceof Date ? value : new Date(String(value))
            if (Number.isNaN(date.getTime())) return false
            const iso = date.toISOString()
            // Without a comparison, a date matches by prefix, so `2024-03`
            // means "some time in March 2024".
            if (!token.operator) return iso.startsWith(token.value)
            return compare(
                iso.slice(0, token.value.length),
                token.value,
                token.operator
            )
        }
    }
}

function matchesField<T>(
    item: T,
    field: SearchField<T>,
    token: SearchToken
): boolean {
    return toArray(field.get(item)).some((value) =>
        matchesValue(value, field.type, token)
    )
}

function isFreeTextField<T>(field: SearchField<T>): boolean {
    return field.freeText ?? field.type === "string"
}

/**
 * Builds a predicate for `query` over `fields`. All terms must match; terms
 * prefixed with `-` must not.
 */
export function makeSearchFilter<T>(
    query: string | undefined,
    fields: readonly SearchField<T>[]
): (item: T) => boolean {
    const tokens = parseSearchQuery(query)
    if (tokens.length === 0) return () => true

    const fieldsByName = new Map(fields.map((field) => [field.name, field]))
    const freeTextFields = fields.filter(isFreeTextField)

    const matchers = tokens.map((token) => {
        const field = token.field ? fieldsByName.get(token.field) : undefined
        if (field) return (item: T) => matchesField(item, field, token)

        // An unknown field means the colon was part of the text
        const freeTextToken: SearchToken = token.field
            ? {
                  value: token.exclude ? token.raw.slice(1) : token.raw,
                  exclude: token.exclude,
                  raw: token.raw,
              }
            : token
        return (item: T) =>
            freeTextFields.some((freeTextField) =>
                matchesField(item, freeTextField, freeTextToken)
            )
    })

    return (item: T) =>
        matchers.every((matches, index) =>
            tokens[index].exclude ? !matches(item) : matches(item)
        )
}

/**
 * The words to highlight in the results: everything the user typed except
 * exclusions and non-text comparisons.
 */
export function searchWordsToHighlight(
    query: string | undefined,
    // Only the name and type matter, so a page whose filtering happens in SQL
    // can pass a plain field list
    fields: readonly Pick<SearchField<never>, "name" | "type">[]
): SearchWord[] {
    const fieldsByName = new Map(fields.map((field) => [field.name, field]))
    return parseSearchQuery(query)
        .filter((token) => {
            if (token.exclude) return false
            if (!token.field) return true
            const field = fieldsByName.get(token.field)
            // An unknown field is free text, and its raw form is what shows up
            // in the results
            return !field || field.type === "string"
        })
        .map((token) => {
            const known = token.field && fieldsByName.has(token.field)
            const word = known || !token.field ? token.value : token.raw
            return {
                regex: buildRegexFromSearchWord(word),
                word,
                exclude: false,
            }
        })
}

export interface SearchFieldHelp {
    name: string
    type: SearchFieldType
    description: string
}

/** The field list shown in a search box's help popover. */
export function describeSearchFields<T>(
    fields: readonly SearchField<T>[]
): SearchFieldHelp[] {
    return fields.map(({ name, type, description }) => ({
        name,
        type,
        description,
    }))
}

/**
 * Whether `term` (e.g. `published:true`) is one of the query's terms.
 *
 * Together with `toggleSearchTerm` this lets a checkbox drive the search
 * string, so a filter set by clicking is still in the URL and still visible
 * in the search box.
 */
export function hasSearchTerm(
    query: string | undefined,
    term: string
): boolean {
    return (query ?? "").split(/\s+/).includes(term)
}

export function toggleSearchTerm(
    query: string | undefined,
    term: string,
    on: boolean
): string {
    const terms = (query ?? "").split(/\s+/).filter((t) => t && t !== term)
    if (on) terms.push(term)
    return terms.join(" ")
}
