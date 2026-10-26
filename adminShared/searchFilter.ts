import { buildRegexFromSearchWord, SearchWord } from "./search.js"
import { parseSearchTerm, splitSearchTerms } from "./variableSearch.js"

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

const OPERATOR = /^(>=|<=|>|<|=)(.+)$/s

/**
 * The terms of `query`, split and read by the grammar the indicator search
 * uses too (`adminShared/variableSearch.ts`), plus the comparisons that only
 * these in-browser lists understand.
 */
export function parseSearchQuery(query: string | undefined): SearchToken[] {
    if (!query?.trim()) return []

    return (
        splitSearchTerms(query)
            // A lone `-` is an exclusion about to be typed, not an exclusion of
            // everything
            .filter((term) => term !== "-")
            .map(parseSearchTerm)
            .map(({ raw, negate: exclude, field, value }): SearchToken => {
                if (field === undefined) return { value, exclude, raw }

                const operatorMatch = OPERATOR.exec(value)
                if (operatorMatch)
                    return {
                        field,
                        operator: operatorMatch[1] as SearchOperator,
                        value: operatorMatch[2],
                        exclude,
                        raw,
                    }
                return { field, value, exclude, raw }
            })
    )
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

// One regex per term rather than per row: the charts list alone runs a term
// against thousands of them on every keystroke
const tokenRegexes = new WeakMap<SearchToken, RegExp>()
function regexFor(token: SearchToken): RegExp {
    let regex = tokenRegexes.get(token)
    if (!regex) {
        regex = buildRegexFromSearchWord(token.value)
        tokenRegexes.set(token, regex)
    }
    return regex
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
            return regexFor(token).test(String(value))
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
            const date =
                value instanceof Date
                    ? value
                    : // epoch milliseconds would parse as an invalid date string
                      new Date(
                          typeof value === "number" ? value : String(value)
                      )
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
 * The query's terms as the page reads them: a `field:` the page doesn't
 * declare is ordinary text, so pasting a URL searches for it; a declared one
 * with no value yet is still being typed, and narrows nothing so the list
 * doesn't blank out mid-keystroke.
 */
function resolveTokens(
    query: string | undefined,
    fieldNames: ReadonlySet<string>
): SearchToken[] {
    return parseSearchQuery(query).flatMap((token): SearchToken[] => {
        if (token.field === undefined) return [token]
        // `charts:>` hasn't got its number yet either
        if (fieldNames.has(token.field))
            return /^[<>=]*$/.test(token.value) ? [] : [token]
        const text = token.exclude ? token.raw.slice(1) : token.raw
        return [
            {
                // `who:` is someone typing a word, not looking for the colon
                value: text.endsWith(":") ? text.slice(0, -1) : text,
                exclude: token.exclude,
                raw: token.raw,
            },
        ]
    })
}

/**
 * Builds a predicate for `query` over `fields`. All terms must match; terms
 * prefixed with `-` must not.
 */
export function makeSearchFilter<T>(
    query: string | undefined,
    fields: readonly SearchField<T>[]
): (item: T) => boolean {
    const fieldsByName = new Map(fields.map((field) => [field.name, field]))
    const tokens = resolveTokens(query, new Set(fieldsByName.keys()))
    if (tokens.length === 0) return () => true

    const freeTextFields = fields.filter(isFreeTextField)

    const matchers = tokens.map((token) => {
        const field = token.field ? fieldsByName.get(token.field) : undefined
        if (field) return (item: T) => matchesField(item, field, token)
        return (item: T) =>
            freeTextFields.some((freeTextField) =>
                matchesField(item, freeTextField, token)
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
    fields: readonly Pick<SearchField<never>, "name" | "type">[]
): SearchWord[] {
    const fieldsByName = new Map(fields.map((field) => [field.name, field]))
    return resolveTokens(query, new Set(fieldsByName.keys()))
        .filter(
            (token) =>
                !token.exclude &&
                (!token.field ||
                    fieldsByName.get(token.field)?.type === "string")
        )
        .map((token) => ({
            regex: buildRegexFromSearchWord(token.value),
            word: token.value,
            exclude: false,
        }))
}

/** What a search box's help popover shows of a field. */
export type SearchFieldHelp = Pick<
    SearchField<never>,
    "name" | "type" | "description"
>

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
