import { buildRegexFromSearchWord, SearchWord } from "./search.js"
import {
    parseSearchTerm,
    SearchFieldHelp,
    splitSearchTerms,
} from "./variableSearch.js"

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

export type SearchFieldType = SearchFieldHelp["type"]

export type SearchFieldValue =
    | string
    | number
    | boolean
    | Date
    | null
    | undefined
    | readonly (string | number | null | undefined)[]

export interface SearchField<T> extends SearchFieldHelp {
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
export function parseSearchTokens(query: string | undefined): SearchToken[] {
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

/**
 * `2024`, `2024-3` or `2024-03-07` as the zero-padded ISO prefix the dates
 * are compared against, or undefined for anything else, which then matches
 * nothing rather than comparing as text
 */
function normalizeDateQuery(value: string): string | undefined {
    const match = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(value)
    if (!match) return undefined
    const [, year, month, day] = match
    return [year, month, day]
        .filter((part) => part !== undefined)
        .map((part) => part.padStart(2, "0"))
        .join("-")
}

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
            const query = normalizeDateQuery(token.value)
            if (query === undefined || Number.isNaN(date.getTime()))
                return false
            const iso = date.toISOString()
            // Without a comparison, a date matches by prefix, so `2024-03`
            // means "some time in March 2024".
            if (!token.operator) return iso.startsWith(query)
            return compare(iso.slice(0, query.length), query, token.operator)
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
    return parseSearchTokens(query).flatMap((token): SearchToken[] => {
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

function isTruthy(value: string): boolean {
    return TRUTHY.has(value.toLowerCase())
}

/**
 * Whether the query asks for `field` to be true (`published:true`, or
 * `Published:yes`).
 *
 * Together with `withBooleanTerm` this lets a checkbox drive the search
 * string, so a filter set by clicking is still in the URL and still visible
 * in the search box.
 */
export function hasTrueTerm(query: string | undefined, field: string): boolean {
    return parseSearchTokens(query).some(
        (token) =>
            token.field === field && !token.exclude && isTruthy(token.value)
    )
}

/**
 * The query with every term of `field` replaced by `field:true`, or just
 * removed when `on` is false, so the box never holds `published:false`
 * next to `published:true`. A trailing space lets typing carry on from the
 * end of the box without running into the term.
 */
export function withBooleanTerm(
    query: string | undefined,
    field: string,
    on: boolean
): string {
    const kept = splitSearchTerms(query ?? "")
        .filter((term) => parseSearchTerm(term).field !== field)
        // a phrase has to go back in quotes to stay one term
        .map((term) => (/\s/.test(term) ? `"${term}"` : term))
    if (on) kept.push(`${field}:true`)
    return on ? `${kept.join(" ")} ` : kept.join(" ")
}
