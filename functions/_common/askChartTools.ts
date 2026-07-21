import { fetchInputTableForConfig } from "@ourworldindata/grapher"
import { assembleCsv, assembleReadme } from "./downloadFunctions.js"
import { Env } from "./env.js"
import { getDataApiUrl, initGrapher } from "./grapherTools.js"
import { TWITTER_OPTIONS } from "./imageOptions.js"

export const ASK_CHART_DEFAULT_MODEL = "gpt-5.6-terra"

// Rough character budget for the CSV we hand to the model. Keeps the prompt
// (and thus cost/latency) bounded for indicators with very long data tables.
const MAX_CSV_CHARS = 250_000

export interface AskChartContext {
    readme: string
    csv: string | undefined
    csvTruncated: boolean
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

    return {
        readme,
        csv: csvSample?.text,
        csvTruncated: csvSample?.truncated ?? false,
    }
}

/** Renders the chart context as prompt sections shared by all ask-chart prompts */
export function describeAskChartContext({
    readme,
    csv,
    csvTruncated,
}: AskChartContext): string {
    const sections = [
        `## Chart documentation

${readme}`,
    ]
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
