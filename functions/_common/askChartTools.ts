import { fetchInputTableForConfig, GrapherState } from "@ourworldindata/grapher"
import { OwidColumnDef, SearchUrlParam } from "@ourworldindata/types"
import { assembleCsv, assembleReadme } from "./downloadFunctions.js"
import { Env } from "./env.js"
import { getDataApiUrl, initGrapher } from "./grapherTools.js"
import { TWITTER_OPTIONS } from "./imageOptions.js"

export const ASK_CHART_DEFAULT_MODEL = "gpt-5.6-terra"

// Rough character budget for the CSV we hand to the model. Keeps the prompt
// (and thus cost/latency) bounded for indicators with very long data tables.
const MAX_CSV_CHARS = 250_000

const SEARCH_API_URL = "https://ourworldindata.org/api/search"
// Bulky per-hit fields that only bloat the prompt without adding useful context
const STRIPPED_SEARCH_RESULT_KEYS = new Set([
    "availableEntities",
    "originalAvailableEntities",
])

export interface AskChartContext {
    readme: string
    csv: string | undefined
    csvTruncated: boolean
    mainTopic: string | undefined
    relatedResultsJson: string | undefined
}

export function getAskChartModel(env: Env): string {
    return env.ASK_CHART_OPENAI_MODEL || ASK_CHART_DEFAULT_MODEL
}

/**
 * Evenly samples data rows if the CSV exceeds the character budget, so the
 * model still sees the full range of entities and years rather than only the
 * alphabetically-first rows.
 */
function sampleCsvToBudget(csv: string): { text: string; truncated: boolean } {
    if (csv.length <= MAX_CSV_CHARS) return { text: csv, truncated: false }
    const [header, ...rows] = csv.split("\n")
    const keepEveryNth = Math.ceil(csv.length / MAX_CSV_CHARS)
    const sampledRows = rows.filter((_, index) => index % keepEveryNth === 0)
    return {
        text: [header, ...sampledRows].join("\n"),
        truncated: true,
    }
}

function getMainChartTopic(grapherState: GrapherState): string | undefined {
    for (const column of grapherState.inputTable.columnsAsArray) {
        const def: OwidColumnDef = column.def
        const topic = def.presentation?.topicTagsLinks?.[0]
        if (topic) return topic
    }
    return undefined
}

function stripSearchResultKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripSearchResultKeys)
    if (value && typeof value === "object")
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([key]) => !STRIPPED_SEARCH_RESULT_KEYS.has(key))
                .map(([key, entry]) => [key, stripSearchResultKeys(entry)])
        )
    return value
}

async function fetchSearchResultsForTopic(
    topic: string,
    type: "charts" | "pages"
): Promise<unknown | undefined> {
    try {
        const searchUrl = new URL(SEARCH_API_URL)
        searchUrl.searchParams.set(SearchUrlParam.TOPIC, topic)

        searchUrl.searchParams.set("type", type)
        const response = await fetch(searchUrl)
        if (!response.ok) return undefined
        return stripSearchResultKeys(await response.json())
    } catch (error) {
        // Related results are optional context — don't fail the request
        console.error(`Failed to fetch related ${type} search results:`, error)
        return undefined
    }
}

/**
 * Fetches site search results (both charts and articles) for the chart's main
 * topic so the model can point visitors to related content that actually
 * exists.
 */
async function fetchRelatedResultsForTopic(
    topic: string
): Promise<string | undefined> {
    const [charts, pages] = await Promise.all([
        fetchSearchResultsForTopic(topic, "charts"),
        fetchSearchResultsForTopic(topic, "pages"),
    ])
    if (charts === undefined && pages === undefined) return undefined
    return JSON.stringify({ charts, pages })
}

/**
 * Reassembles a chart's documentation and data server-side (rather than
 * trusting client-supplied context) using the same helpers that power the
 * readme/CSV download endpoints.
 */
export async function buildAskChartContext(
    slug: string,
    env: Env
): Promise<AskChartContext> {
    const { grapher, multiDimAvailableDimensions } = await initGrapher(
        { type: "slug", id: slug },
        TWITTER_OPTIONS,
        new URLSearchParams(""),
        env
    )
    const inputTable = await fetchInputTableForConfig({
        dimensions: grapher.grapherState.dimensions,
        selectedEntityColors: grapher.grapherState.selectedEntityColors,
        dataApiUrl: getDataApiUrl(env),
    })
    if (inputTable) grapher.grapherState.inputTable = inputTable

    const readme = assembleReadme(
        grapher.grapherState,
        new URLSearchParams(""),
        multiDimAvailableDimensions
    )

    const isNonRedistributable =
        grapher.grapherState.inputTable.columnsAsArray.some(
            (column) => column.def.nonRedistributable
        )
    const csvSample = isNonRedistributable
        ? undefined
        : sampleCsvToBudget(
              assembleCsv(grapher.grapherState, new URLSearchParams(""))
          )

    const mainTopic = getMainChartTopic(grapher.grapherState)
    const relatedResultsJson = mainTopic
        ? await fetchRelatedResultsForTopic(mainTopic)
        : undefined

    return {
        readme,
        csv: csvSample?.text,
        csvTruncated: csvSample?.truncated ?? false,
        mainTopic,
        relatedResultsJson,
    }
}

/** Renders the chart context as prompt sections shared by all ask-chart prompts */
export function describeAskChartContext({
    readme,
    csv,
    csvTruncated,
    mainTopic,
    relatedResultsJson,
}: AskChartContext): string {
    const sections = [
        `## Chart documentation

${readme}`,
    ]
    if (relatedResultsJson) {
        sections.push(
            `## Related charts and articles on Our World in Data

The following JSON contains site search results for this chart's main topic ("${mainTopic}"), grouped into "charts" (related data charts) and "pages" (related articles and topic pages). You may draw on these and link to them — their URLs are real — but only when it genuinely makes sense in context; do not force references to them.

${relatedResultsJson}`
        )
    }
    if (csv) {
        sections.push(
            `## Chart data (CSV${
                csvTruncated
                    ? ", evenly sampled to fit — individual rows may be missing"
                    : ""
            })

${csv}`
        )
    } else {
        sections.push(
            `## Chart data

The underlying data table is not available to you (it is not redistributable). Answer from the documentation above and say so if a question requires the raw data.`
        )
    }
    return sections.join("\n\n")
}
