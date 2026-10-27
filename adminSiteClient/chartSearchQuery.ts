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

export type ChartSearchFacet = IsFacet | "tag" | "author"

type IsFacet = "status" | "source"

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

function isValueOf(value: string): IsValue | undefined {
    return (IS_VALUES as Record<string, IsValue>)[value.toLowerCase()]
}

function facetOfTerm(term: SearchTerm): ChartSearchFacet | undefined {
    if (isTextTerm(term)) return undefined
    if (term.field === "is") return isValueOf(term.value)?.facet
    return term.field as ChartSearchFacet
}

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

function isTextTerm(term: SearchTerm): boolean {
    return term.field === undefined || !FIELD_NAMES.has(term.field)
}

function toSearchWord(word: string, exclude: boolean): SearchWord {
    return { word, regex: buildRegexFromSearchWord(word), exclude }
}

function textWords(terms: SearchTerm[]): SearchWord[] {
    return terms.filter(isTextTerm).flatMap((term) => {
        const word = term.negate ? term.raw.slice(1) : term.raw
        return word ? [toSearchWord(word, term.negate)] : []
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
    const facets = Object.values(
        _.groupBy(filters, (filter) => filter.facet)
    ).map((group) => {
        const [excluded, included] = _.partition(group, (f) => f.negate)
        return { included, excluded }
    })

    return (chart) =>
        matchesText(chart) &&
        facets.every(
            ({ included, excluded }) =>
                (included.length === 0 ||
                    included.some((filter) => filter.test(chart))) &&
                excluded.every((filter) => !filter.test(chart))
        )
}

export function chartSearchWordsToHighlight(query: string): {
    inText: SearchWord[]
    inAuthors: SearchWord[]
} {
    const terms = parseSearchQuery(query)
    const authors = terms
        .filter((term) => !term.negate && facetOfTerm(term) === "author")
        .map((term) => term.value)
        .filter(Boolean)
        .map((word) => toSearchWord(word, false))
    const inText = textWords(terms)
    return { inText, inAuthors: [...inText, ...authors] }
}

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
    return /\s/.test(term.raw) ? `"${term.raw}"` : term.raw
}

function fieldOfFacet(facet: ChartSearchFacet): ChartSearchField {
    return facet === "status" || facet === "source" ? "is" : facet
}

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

export function setFacetValues(
    query: string,
    facet: ChartSearchFacet,
    values: readonly string[]
): string {
    const field = fieldOfFacet(facet)
    const picked = new Set(values.map((value) => value.toLowerCase()))
    const kept = parseSearchQuery(query)
        .filter(
            (term) =>
                facetOfTerm(term) !== facet ||
                (term.negate &&
                    term.value &&
                    !picked.has(term.value.toLowerCase()))
        )
        .map(reformatTerm)
    return [...kept, ...values.map((value) => formatTerm(field, value))].join(
        " "
    )
}

export function hasChartFilters(query: string): boolean {
    return parseSearchQuery(query).some(
        (term) => term.value !== "" && facetOfTerm(term) !== undefined
    )
}

export interface NameCount {
    name: string
    count: number
}

export type SuggestionGroup =
    | "Tags"
    | "Authors"
    | "Status and source"
    | "Filters"

export interface ChartSearchSuggestion {
    resultingQuery: string
    group: SuggestionGroup
    label: string
    count?: number
    expectsValue?: boolean
}

export function splitOffCurrentTerm(query: string): {
    before: string
    current: string
} {
    const last = tokenize(query).tokens.at(-1)
    const start =
        last && last.start + last.text.length === query.length
            ? last.start
            : query.length
    return { before: query.slice(0, start), current: query.slice(start) }
}

const MAX_NAMES = { field: 8, word: 4 }

const MIN_SUGGESTION_LENGTH = 3

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
    start: number
    value: string
    field?: "tag" | "author"
    negate?: boolean
}

function isPlainWord(token: Token): boolean {
    return (
        !token.text.includes('"') &&
        !token.text.startsWith("-") &&
        parseSearchTerm(token.text).field === undefined
    )
}

function trailingPlainWords(tokens: Token[]): Token[] {
    const words: Token[] = []
    for (let i = tokens.length - 1; i >= 0; i--) {
        if (!isPlainWord(tokens[i]) || words.length === MAX_PHRASE_WORDS) break
        words.unshift(tokens[i])
    }
    return words
}

function nameTermWithWords(
    headToken: Token | undefined,
    words: Token[],
    join: (parts: string[]) => string,
    hasTrailingSpace: boolean
): Phrase | undefined {
    const head = headToken && parseSearchTerm(headToken.text)
    if (
        !head ||
        !head.value ||
        headToken.text.includes('"') ||
        (head.field !== "tag" && head.field !== "author") ||
        (words.length === 0 && !hasTrailingSpace)
    )
        return undefined
    return {
        start: headToken.start,
        value: join([head.value, ...words.map((word) => word.text)]),
        field: head.field,
        negate: head.negate,
    }
}

function wordPhrases(
    words: Token[],
    join: (parts: string[]) => string,
    hasTrailingSpace: boolean
): Phrase[] {
    const minWords = hasTrailingSpace ? 1 : 2
    return _.range(words.length, minWords - 1, -1).map((k) => {
        const phraseWords = words.slice(-k)
        return {
            start: phraseWords[0].start,
            value: join(phraseWords.map((word) => word.text)),
        }
    })
}

function trailingPhrases(query: string): Phrase[] {
    const { tokens, inQuotes } = tokenize(query)
    if (inQuotes) return []
    const words = trailingPlainWords(tokens)
    const hasTrailingSpace = /\s$/.test(query)
    const join = (parts: string[]): string =>
        parts.join(" ") + (hasTrailingSpace ? " " : "")

    const headToken = tokens[tokens.length - words.length - 1]
    const nameTerm = nameTermWithWords(headToken, words, join, hasTrailingSpace)
    return [
        ...(nameTerm ? [nameTerm] : []),
        ...wordPhrases(words, join, hasTrailingSpace),
    ].filter((phrase) => phrase.value.trim().length >= MIN_SUGGESTION_LENGTH)
}

export function suggestChartSearchTerms(
    query: string,
    {
        tags,
        authors,
    }: { tags: readonly NameCount[]; authors: readonly NameCount[] }
): ChartSearchSuggestion[] {
    const takenIn = (
        before: string,
        field: ChartSearchField
    ): ReadonlySet<string> =>
        new Set(
            parseSearchQuery(before)
                .filter((term) => term.field === field && term.value)
                .map((term) => term.value.toLowerCase())
        )
    const nameSuggestions = (
        facet: "tag" | "author",
        value: string,
        max: number,
        before: string,
        negate = false
    ): ChartSearchSuggestion[] =>
        matchingNames(
            facet === "tag" ? tags : authors,
            value,
            takenIn(before, facet)
        )
            .slice(0, max)
            .map(({ name, count }) => ({
                resultingQuery: `${before}${formatTerm(facet, name, negate)} `,
                group: facet === "tag" ? "Tags" : "Authors",
                label: name,
                count,
            }))

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
                before,
                phrase.negate
            )
        )
        if (phraseSuggestions.length > 0) break
    }

    const { before, current } = splitOffCurrentTerm(query)
    if (!current) return phraseSuggestions
    const term = parseSearchTerm(current.replaceAll('"', ""))

    const isTaken = takenIn(before, "is")
    const isSuggestions = (value: string): ChartSearchSuggestion[] =>
        Object.entries(IS_VALUES)
            .filter(
                ([name, { label }]) =>
                    !isTaken.has(name) &&
                    (name.startsWith(value.toLowerCase()) ||
                        label.toLowerCase().startsWith(value.toLowerCase()))
            )
            .map(([name, { label }]) => ({
                resultingQuery: `${before}${formatTerm("is", name, term.negate)} `,
                group: "Status and source",
                label: `${formatTerm("is", name)} — ${label}`,
            }))

    switch (term.field) {
        case "tag":
        case "author":
            return nameSuggestions(
                term.field,
                term.value,
                MAX_NAMES.field,
                before,
                term.negate
            )
        case "is":
            return isSuggestions(term.value)
    }

    if (term.field !== undefined || term.value.length < MIN_SUGGESTION_LENGTH)
        return phraseSuggestions

    const fieldSuggestions: ChartSearchSuggestion[] =
        CHART_SEARCH_FIELDS.filter((field) =>
            field.name.startsWith(term.value.toLowerCase())
        ).map((field) => ({
            resultingQuery: `${before}${term.negate ? "-" : ""}${field.name}:`,
            group: "Filters",
            label: `${field.name}: — ${field.description}`,
            expectsValue: true,
        }))

    const wordNameSuggestions =
        phraseSuggestions.length > 0
            ? []
            : (["tag", "author"] as const).flatMap((facet) =>
                  nameSuggestions(
                      facet,
                      term.value,
                      MAX_NAMES.word,
                      before,
                      term.negate
                  )
              )
    return [
        ...phraseSuggestions,
        ...wordNameSuggestions,
        ...isSuggestions(term.value),
        ...fieldSuggestions,
    ]
}

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
