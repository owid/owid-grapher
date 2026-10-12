// The indicator search's grammar and wire format, shared by the server that
// runs it (`analyzeVariableSearch` in `db/model/Variable.ts`) and the admin
// page that offers it: space-separated terms, `-exclusions` and `field:value`.

/**
 * Split on whitespace except inside double quotes, which keep a phrase
 * together and are dropped. A lone unbalanced quote runs to the end.
 */
export function splitSearchTerms(query: string): string[] {
    const terms: string[] = []
    let current = ""
    let inQuotes = false
    for (const char of query) {
        if (char === '"') inQuotes = !inQuotes
        else if (/\s/.test(char) && !inQuotes) {
            if (current) terms.push(current)
            current = ""
        } else current += char
    }
    if (current) terms.push(current)
    return terms
}

export interface SearchTerm {
    /** The term as typed, quotes aside. */
    raw: string
    negate: boolean
    /**
     * Lowercased, so `Dataset-ID:12` isn't quietly searched as text. Absent
     * for a plain word, and not necessarily one of the search fields.
     */
    field?: string
    /** Everything after the field's colon, or the whole word without one. */
    value: string
}

// `s`, so a quoted value can span a line break
const FIELDED_TERM = /^([a-zA-Z][\w-]*):(.*)$/s

export function parseSearchTerm(term: string): SearchTerm {
    const raw = term.trim()
    const negate = raw.startsWith("-")
    const body = negate ? raw.slice(1) : raw
    const fielded = FIELDED_TERM.exec(body)
    return fielded
        ? { raw, negate, field: fielded[1].toLowerCase(), value: fielded[2] }
        : { raw, negate, value: body }
}

export function parseSearchQuery(query: string): SearchTerm[] {
    return splitSearchTerms(query).map(parseSearchTerm)
}

export interface SearchFieldHelp {
    name: string
    /** Only string fields have their value highlighted in the results. */
    type: "string" | "number" | "date"
    description: string
}

/** The `field:value` terms the search understands, as listed in its help. */
export const INDICATOR_SEARCH_FIELDS = [
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
        name: "dataset-id",
        type: "number",
        description: "Exactly one dataset, by id",
    },
    { name: "table", type: "string", description: "Table segment" },
    { name: "short", type: "string", description: "Indicator short name" },
    {
        name: "dataset-name",
        type: "string",
        description: "The dataset's title",
    },
    { name: "before", type: "date", description: "Version before this date" },
    { name: "after", type: "date", description: "Version after this date" },
    { name: "is", type: "string", description: "public or private" },
] as const satisfies readonly SearchFieldHelp[]

export type IndicatorSearchField =
    (typeof INDICATOR_SEARCH_FIELDS)[number]["name"]

const SEARCH_FIELDS_BY_NAME: ReadonlyMap<string, SearchFieldHelp> = new Map(
    INDICATOR_SEARCH_FIELDS.map((field) => [field.name, field])
)

/** The field a term names, if it is one the search understands. */
export function searchFieldOf(term: SearchTerm): SearchFieldHelp | undefined {
    return term.field === undefined
        ? undefined
        : SEARCH_FIELDS_BY_NAME.get(term.field)
}

export interface VariableUsage {
    charts: { id: number; slug: string | null; title: string | null }[]
    /** An unpublished multi-dim has no slug yet, only a title. */
    multiDims: { id: number; slug: string | null; title: string | null }[]
    explorerSlugs: string[]
    /** Charts, multi-dims and path-based explorers together. */
    usageCount: number
}

/** One indicator in a search result, with its usage attached. */
export interface VariableResultView extends VariableUsage {
    id: number
    name: string
    catalogPath: string | null
    datasetId: number
    datasetName: string
    isPrivate: boolean
    nonRedistributable: boolean
    uploadedAt: string
    uploadedBy: string | null
    /** 0-1, from the analytics service. Null for indicators nobody reads. */
    popularity: number | null
}

interface SearchResultNotices {
    /** Terms that had to fall back to a substring scan, and so cost a second. */
    unindexedTerms: string[]
    /** Set when MySQL couldn't run a term as a regular expression. */
    regexError?: string
}

export interface VariablesSearchResult extends SearchResultNotices {
    variables: VariableResultView[]
    numTotalRows: number
}

export interface DatasetSearchGroup {
    id: number
    name: string
    namespace: string
    version: string | null
    /** The dataset segment of the catalog path, for narrowing to it. */
    shortName: string | null
    /** How many of this dataset's indicators matched, not how many are shown. */
    matchCount: number
    /** A dataset is uploaded as a whole, so this belongs to the group. */
    uploadedAt: string
    uploadedBy: string | null
    variables: VariableResultView[]
}

export interface VariablesGroupedSearchResult extends SearchResultNotices {
    datasets: DatasetSearchGroup[]
    numTotalDatasets: number
    numTotalRows: number
}
