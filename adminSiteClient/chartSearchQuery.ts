import * as _ from "lodash-es"
import {
    parseSearchQuery,
    parseSearchTerm,
    SearchFieldHelp,
    SearchTerm,
} from "../adminShared/variableSearch.js"
import {
    buildRegexFromSearchWord,
    filterFunctionForSearchWords,
    SearchWord,
} from "../adminShared/search.js"
import type { ChartListItem } from "./ChartList.js"
import { getChartListItemEtlSource, hasEtlDrift } from "./etlChartSync.js"

// The chart list's search, run in the browser over the charts it holds. It
// speaks the indicator search's grammar (`adminShared/variableSearch.ts`):
// space-separated words, `"phrases"`, `-exclusions` and `field:value` terms.
//
// The query is the whole of the list's filter state. The filter controls next
// to the search box read their value out of it and write it back into it, so
// the box and the controls can't disagree, and the URL holds every filter.

/** The `field:value` terms the chart search understands, as listed in its help. */
export const CHART_SEARCH_FIELDS = [
    {
        name: "is",
        type: "string",
        description:
            "draft or published; etl, drifted (ETL, since changed in the admin) or admin",
    },
    { name: "tag", type: "string", description: "Has this tag" },
    {
        name: "author",
        type: "string",
        description: "Last edited or published by this person",
    },
] as const satisfies readonly SearchFieldHelp[]

export type ChartSearchField = (typeof CHART_SEARCH_FIELDS)[number]["name"]

const FIELD_NAMES: ReadonlySet<string> = new Set(
    CHART_SEARCH_FIELDS.map((field) => field.name)
)

/**
 * What a filter control sets. Terms of one facet are alternatives (OR), terms
 * of different facets all have to hold (AND). `is:` covers two facets, so that
 * `is:draft is:etl` means ETL drafts rather than drafts or ETL charts.
 */
export type ChartSearchFacet =
    | "status"
    | "source"
    | Exclude<ChartSearchField, "is">

type IsFacet = Extract<ChartSearchFacet, "status" | "source">

interface IsValue {
    facet: IsFacet
    label: string
    test: (chart: ChartListItem) => boolean
}

export const IS_VALUES = {
    published: {
        facet: "status",
        label: "Published",
        test: (chart) => !!chart.isPublished,
    },
    draft: {
        facet: "status",
        label: "Draft",
        test: (chart) => !chart.isPublished,
    },
    etl: {
        facet: "source",
        label: "Created in ETL",
        test: (chart) => chart.isEtlManaged,
    },
    drifted: {
        facet: "source",
        label: "ETL, since changed in the admin",
        test: (chart) => {
            const etlSource = getChartListItemEtlSource(chart)
            return !!etlSource && hasEtlDrift(etlSource.drift)
        },
    },
    admin: {
        facet: "source",
        label: "Created in the admin",
        test: (chart) => !chart.isEtlManaged,
    },
} as const satisfies Record<string, IsValue>

export type IsValueName = keyof typeof IS_VALUES

function isValueOf(value: string): IsValue | undefined {
    return (IS_VALUES as Record<string, IsValue>)[value.toLowerCase()]
}

function facetOfTerm(term: SearchTerm): ChartSearchFacet | undefined {
    if (isTextTerm(term)) return undefined
    if (term.field === "is") return isValueOf(term.value)?.facet
    return term.field as ChartSearchFacet
}

/**
 * A name matches a value that is that name, ignoring case. While the value is
 * still being typed and no name is it yet, it matches the names it begins.
 */
function nameMatcher(
    value: string,
    knownNames: () => ReadonlySet<string>
): (name: string | undefined) => boolean {
    const wanted = value.toLowerCase()
    const isExact = knownNames().has(wanted)
    return (name) => {
        if (!name) return false
        const lower = name.toLowerCase()
        return isExact ? lower === wanted : lower.startsWith(wanted)
    }
}

interface ChartFilter {
    facet: ChartSearchFacet
    negate: boolean
    test: (chart: ChartListItem) => boolean
}

/**
 * A plain word, or an unknown `field:` searched as text, as the indicator
 * search does: `https://…` is no field. A known field's terms never are, even
 * while unfinished.
 */
function isTextTerm(term: SearchTerm): boolean {
    return term.field === undefined || !FIELD_NAMES.has(term.field)
}

function textWords(terms: SearchTerm[]): SearchWord[] {
    return terms.filter(isTextTerm).flatMap((term) => {
        const word = term.negate ? term.raw.slice(1) : term.raw
        if (!word) return []
        return [
            {
                word,
                regex: buildRegexFromSearchWord(word),
                exclude: term.negate,
            },
        ]
    })
}

function chartTextFields(chart: ChartListItem): (string | undefined)[] {
    return [
        chart.title,
        chart.variantName,
        chart.internalNotes,
        chart.publishedBy,
        chart.lastEditedBy,
        `${chart.id}`,
        chart.slug,
        chart.hasChartTab !== false ? chart.type : undefined,
        chart.hasMapTab ? "Map" : undefined,
        ...chart.tags.map((tag) => tag.name),
    ]
}

/**
 * The filter a query describes, over the charts it will run on (which also
 * tell a finished tag or author name from one still being typed).
 *
 * A known field with no value yet and an `is:` value that isn't one narrow
 * nothing, so the list doesn't empty while a term is being typed.
 */
export function chartSearchFilter(
    query: string,
    charts: readonly ChartListItem[]
): (chart: ChartListItem) => boolean {
    const terms = parseSearchQuery(query)

    const tagNames = _.once(
        () =>
            new Set(
                charts.flatMap((chart) =>
                    chart.tags.map((tag) => tag.name.toLowerCase())
                )
            )
    )
    const authorNames = _.once(
        () =>
            new Set(
                charts
                    .flatMap((chart) => [chart.lastEditedBy, chart.publishedBy])
                    .filter(Boolean)
                    .map((name) => name.toLowerCase())
            )
    )

    const filters: ChartFilter[] = []
    for (const term of terms) {
        const facet = facetOfTerm(term)
        if (!facet || !term.value) continue
        const add = (test: ChartFilter["test"]): void => {
            filters.push({ facet, negate: term.negate, test })
        }
        switch (facet) {
            case "status":
            case "source":
                add(isValueOf(term.value)!.test)
                break
            case "tag": {
                const matches = nameMatcher(term.value, tagNames)
                add((chart) => chart.tags.some((tag) => matches(tag.name)))
                break
            }
            case "author": {
                const matches = nameMatcher(term.value, authorNames)
                add(
                    (chart) =>
                        matches(chart.lastEditedBy) ||
                        matches(chart.publishedBy)
                )
                break
            }
        }
    }

    const matchesText = filterFunctionForSearchWords(
        textWords(terms),
        chartTextFields
    )
    const facets = Object.values(_.groupBy(filters, (filter) => filter.facet))

    return (chart) =>
        matchesText(chart) &&
        facets.every((group) => {
            const included = group.filter((filter) => !filter.negate)
            const excluded = group.filter((filter) => filter.negate)
            return (
                (included.length === 0 ||
                    included.some((filter) => filter.test(chart))) &&
                excluded.every((filter) => !filter.test(chart))
            )
        })
}

/**
 * What to highlight in the list: the plain words, and the people an `author:`
 * term names, so the filter shows where it matched.
 */
export function chartSearchWordsToHighlight(query: string): SearchWord[] {
    const terms = parseSearchQuery(query)
    const authors = terms
        .filter((term) => !term.negate && facetOfTerm(term) === "author")
        .map((term) => term.value)
        .filter(Boolean)
        .map((word) => ({
            word,
            regex: buildRegexFromSearchWord(word),
            exclude: false,
        }))
    return [...textWords(terms), ...authors]
}

// Rewriting the query, for the filter controls

/** A term as it goes back into the query, quoted if it has spaces. */
export function formatTerm(
    field: ChartSearchField,
    value: string,
    negate = false
): string {
    const quoted = /\s/.test(value) ? `"${value}"` : value
    return `${negate ? "-" : ""}${field}:${quoted}`
}

function reformatTerm(term: SearchTerm): string {
    if (!isTextTerm(term))
        return formatTerm(
            term.field as ChartSearchField,
            term.value,
            term.negate
        )
    // a phrase has to go back in quotes to stay one term
    return /\s/.test(term.raw) ? `"${term.raw}"` : term.raw
}

function fieldOfFacet(facet: ChartSearchFacet): ChartSearchField {
    return facet === "status" || facet === "source" ? "is" : facet
}

/** The values a facet's control shows: its included terms, as typed. */
export function getFacetValues(
    query: string,
    facet: ChartSearchFacet
): string[] {
    return parseSearchQuery(query)
        .filter((term) => !term.negate && term.value)
        .filter((term) => facetOfTerm(term) === facet)
        .map((term) =>
            term.field === "is" ? term.value.toLowerCase() : term.value
        )
}

/**
 * The query with a facet's terms, excluded ones too, replaced by one term per
 * value, at the end. Everything else is kept, in order.
 */
export function setFacetValues(
    query: string,
    facet: ChartSearchFacet,
    values: readonly string[]
): string {
    const field = fieldOfFacet(facet)
    const kept = parseSearchQuery(query)
        .filter((term) => facetOfTerm(term) !== facet)
        .map(reformatTerm)
    return [...kept, ...values.map((value) => formatTerm(field, value))].join(
        " "
    )
}

/** Whether the query filters on anything beyond plain words. */
export function hasChartFilters(query: string): boolean {
    return parseSearchQuery(query).some(
        (term) => term.value !== "" && facetOfTerm(term) !== undefined
    )
}

// Suggestions as the user types

export interface NameCount {
    name: string
    /** How many of the list's charts it applies to. */
    count: number
}

export type SuggestionGroup =
    | "Tags"
    | "Authors"
    | "Status and source"
    | "Filters"

export interface ChartSearchSuggestion {
    /** The whole query once the suggestion is taken. */
    query: string
    group: SuggestionGroup
    label: string
    count?: number
}

/**
 * The query up to the term being typed, and that term. Typing happens at the
 * end, so that is the last term, or none after a space; a space inside an
 * open quote is still part of the term.
 */
export function splitOffCurrentTerm(query: string): {
    before: string
    current: string
} {
    let start = query.length
    let inQuotes = false
    let inTerm = false
    for (let i = 0; i < query.length; i++) {
        const char = query[i]
        if (char === '"') inQuotes = !inQuotes
        if (/\s/.test(char) && !inQuotes) inTerm = false
        else if (!inTerm) {
            inTerm = true
            start = i
        }
    }
    if (!inTerm) start = query.length
    return { before: query.slice(0, start), current: query.slice(start) }
}

const MAX_NAMES = { field: 8, word: 4 }

/** How long a plain word gets before it is offered as a filter. */
const MIN_WORD_LENGTH = 3

/** Names containing `value`, those it begins first, then the most used. */
function matchingNames(
    names: readonly NameCount[],
    value: string,
    exclude: ReadonlySet<string>
): NameCount[] {
    const wanted = value.toLowerCase()
    return _.sortBy(
        names.filter(
            ({ name }) =>
                name.toLowerCase().includes(wanted) &&
                !exclude.has(name.toLowerCase())
        ),
        [
            ({ name }) => !name.toLowerCase().startsWith(wanted),
            ({ count }) => -count,
        ]
    )
}

interface Token {
    start: number
    text: string
}

/** The terms of a query with where each starts, and whether a quote is open. */
function tokenize(query: string): { tokens: Token[]; inQuotes: boolean } {
    const tokens: Token[] = []
    let inQuotes = false
    let current: Token | undefined
    for (let i = 0; i < query.length; i++) {
        const char = query[i]
        if (char === '"') inQuotes = !inQuotes
        if (/\s/.test(char) && !inQuotes) {
            if (current) tokens.push(current)
            current = undefined
        } else if (current) current.text += char
        else current = { start: i, text: char }
    }
    if (current) tokens.push(current)
    return { tokens, inQuotes }
}

const MAX_PHRASE_WORDS = 4

interface Phrase {
    /** Where in the query the phrase starts, so a pick replaces all of it. */
    start: number
    value: string
    /** Set when the phrase continues a `tag:` or `author:` term. */
    field?: "tag" | "author"
}

/**
 * The multi-word names the end of the query could be the start of, longest
 * first: its last few plain words, or a `tag:` or `author:` term and the words
 * typed after it. A space ends a term, so "Life Expectancy" typed out is two
 * words, "life" and "exp…", and only the phrase finds the tag. After a space,
 * the phrase keeps it: "life " is still typing a name.
 */
function trailingPhrases(query: string): Phrase[] {
    const { tokens, inQuotes } = tokenize(query)
    // an open quote is a single term still being typed, handled as such
    if (inQuotes) return []
    const isPlainWord = (token: Token): boolean =>
        !token.text.includes('"') &&
        !token.text.startsWith("-") &&
        parseSearchTerm(token.text).field === undefined

    const words: Token[] = []
    for (let i = tokens.length - 1; i >= 0; i--) {
        if (!isPlainWord(tokens[i]) || words.length === MAX_PHRASE_WORDS) break
        words.unshift(tokens[i])
    }
    const trailingSpace = /\s$/.test(query) ? " " : ""
    const join = (parts: string[]): string => parts.join(" ") + trailingSpace

    const phrases: Phrase[] = []
    const headToken = tokens[tokens.length - words.length - 1]
    const head = headToken && parseSearchTerm(headToken.text)
    if (
        head &&
        !head.negate &&
        head.value &&
        !headToken.text.includes('"') &&
        (head.field === "tag" || head.field === "author") &&
        (words.length > 0 || trailingSpace)
    )
        phrases.push({
            start: headToken.start,
            value: join([head.value, ...words.map((word) => word.text)]),
            field: head.field,
        })
    for (let k = words.length; k >= 1; k--) {
        // a single word without a space after it is the term being typed
        if (k === 1 && !trailingSpace) break
        const phraseWords = words.slice(-k)
        phrases.push({
            start: phraseWords[0].start,
            value: join(phraseWords.map((word) => word.text)),
        })
    }
    return phrases.filter(
        (phrase) => phrase.value.trim().length >= MIN_WORD_LENGTH
    )
}

/**
 * Filter terms for what is being typed. After `tag:`, `author:` or `is:`, its
 * values; after a plain word, the tags, people, statuses and
 * fields it could mean, so that typing "energy" offers `tag:Energy` without
 * getting in the way of searching titles for it.
 */
export function suggestChartSearchTerms(
    query: string,
    {
        tags,
        authors,
    }: { tags: readonly NameCount[]; authors: readonly NameCount[] }
): ChartSearchSuggestion[] {
    const taken = (facet: ChartSearchFacet): ReadonlySet<string> =>
        new Set(
            getFacetValues(query, facet).map((value) => value.toLowerCase())
        )
    const nameSuggestions = (
        facet: "tag" | "author",
        value: string,
        max: number,
        before: string,
        negate = false
    ): ChartSearchSuggestion[] =>
        matchingNames(facet === "tag" ? tags : authors, value, taken(facet))
            .slice(0, max)
            .map(({ name, count }) => ({
                query: `${before}${formatTerm(facet, name, negate)} `,
                group: facet === "tag" ? "Tags" : "Authors",
                label: name,
                count,
            }))

    // The longest phrase that names something, replacing all of its words
    let phraseSuggestions: ChartSearchSuggestion[] = []
    for (const phrase of trailingPhrases(query)) {
        const before = query.slice(0, phrase.start)
        const facets = phrase.field
            ? [phrase.field]
            : (["tag", "author"] as const)
        phraseSuggestions = facets.flatMap((facet) =>
            nameSuggestions(
                facet,
                phrase.value,
                phrase.field ? MAX_NAMES.field : MAX_NAMES.word,
                before
            )
        )
        if (phraseSuggestions.length > 0) break
    }

    const { before, current } = splitOffCurrentTerm(query)
    if (!current) return phraseSuggestions
    const term = parseSearchTerm(current.replaceAll('"', ""))
    const withTerm = (field: ChartSearchField, value: string): string =>
        `${before}${formatTerm(field, value, term.negate)} `

    const tagSuggestions = (
        value: string,
        max: number
    ): ChartSearchSuggestion[] =>
        nameSuggestions("tag", value, max, before, term.negate)
    const authorSuggestions = (
        value: string,
        max: number
    ): ChartSearchSuggestion[] =>
        nameSuggestions("author", value, max, before, term.negate)
    const isSuggestions = (value: string): ChartSearchSuggestion[] =>
        Object.entries(IS_VALUES)
            .filter(
                ([name, { label }]) =>
                    name.startsWith(value.toLowerCase()) ||
                    label.toLowerCase().startsWith(value.toLowerCase())
            )
            .map(([name, { label }]) => ({
                query: withTerm("is", name),
                group: "Status and source",
                label: `${formatTerm("is", name)} — ${label}`,
            }))

    if (!isTextTerm(term)) {
        const field = term.field as ChartSearchField
        switch (field) {
            case "tag":
                return tagSuggestions(term.value, MAX_NAMES.field)
            case "author":
                return authorSuggestions(term.value, MAX_NAMES.field)
            case "is":
                return isSuggestions(term.value)
        }
    }

    // A plain word, too short to tell what it might mean
    if (term.field !== undefined || term.value.length < MIN_WORD_LENGTH)
        return phraseSuggestions

    const fieldSuggestions: ChartSearchSuggestion[] =
        CHART_SEARCH_FIELDS.filter((field) =>
            field.name.startsWith(term.value.toLowerCase())
        ).map((field) => ({
            // no space after it: the value comes next
            query: `${before}${term.negate ? "-" : ""}${field.name}:`,
            group: "Filters",
            label: `${field.name}: — ${field.description}`,
        }))

    // When the words typed so far name something, the last word on its own
    // ("exp" of "life exp") is no longer what is meant
    const wordNameSuggestions =
        phraseSuggestions.length > 0
            ? []
            : [
                  ...tagSuggestions(term.value, MAX_NAMES.word),
                  ...authorSuggestions(term.value, MAX_NAMES.word),
              ]
    return [
        ...phraseSuggestions,
        ...wordNameSuggestions,
        ...isSuggestions(term.value),
        ...fieldSuggestions,
    ]
}

/** Each name with how many of the charts it applies to, most used first. */
export function countNames(
    charts: readonly ChartListItem[],
    namesOf: (chart: ChartListItem) => (string | undefined | null)[]
): NameCount[] {
    const counts = new Map<string, number>()
    for (const chart of charts)
        for (const name of new Set(namesOf(chart)))
            if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
    return _.sortBy(
        [...counts].map(([name, count]) => ({ name, count })),
        [({ count }) => -count, ({ name }) => name]
    )
}
