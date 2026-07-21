import * as Sentry from "@sentry/cloudflare"
import { StatusError } from "itty-router"
import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import { z } from "zod"
import {
    AskChartContext,
    buildAskChartContext,
    describeAskChartContext,
    getAskChartModel,
} from "../../_common/askChartTools.js"
import { Env } from "../../_common/env.js"
import { checkCache } from "../../_common/reusableHandlers.js"

const MAX_OUTPUT_TOKENS = 8000
// Generated FAQs only change when the underlying data or metadata changes,
// which happens at most every few days — cache them for a day.
const CACHE_MAX_AGE_SECONDS = 24 * 60 * 60

const FaqEntriesSchema = z.object({
    faqs: z
        .array(
            z.object({
                question: z.string(),
                answer: z.string(),
            })
        )
        .min(2)
        .max(10),
})

function jsonError(status: number, message: string): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function buildFaqPrompt(context: AskChartContext): string {
    return `You are writing the "Ask this chart" FAQ shown on a data page of Our World in Data (ourworldindata.org). Based on the chart documentation and data below, write 2-10 frequently-asked-question entries that are specific to THIS chart. Write only as many entries as the material genuinely supports — a chart with rich documentation and eventful data deserves more entries than a simple one.

Cover, where relevant:
- What the chart shows and how to read it (units, adjustments like inflation or age-standardization)
- What the unit means in practice: give intuitive reference sizes that make the numbers relatable (e.g. for energy in kilowatt-hours, what a household appliance or an average home uses; for tonnes of CO2, what a flight or a car emits per year). Clearly separate such illustrative comparisons from the chart's own data
- Where the data comes from and how it was collected and processed
- Data quality: how reliable the data is, what its main limitations are, and how much to trust comparisons across countries or over time
- Methodology changes over time (e.g. changed definitions, revised collection methods, new data sources) and how they affect the series
- How outliers — notable peaks and drops in the data — can be explained
- Similar or related charts on Our World in Data and how they differ from this one (only mention charts that actually exist, e.g. from the documentation; skip this topic if you don't know any)
- Definitions of key terms a non-expert might not know
- How this chart may differ from other sources (e.g. UN, World Bank, IMF) or OWID charts on the same topic, and why.

Follow these rules:
- Phrase each question the way a curious visitor would ask it, referring to the chart's actual subject matter (not generic phrasing like "this data").
- Ground the answers in the documentation and data provided below. When the documentation mentions known data quality issues or processing steps, prefer those as explanations.
- When you draw on general knowledge beyond the provided material (e.g. historical events that might explain a spike), say so explicitly.
- Never invent numbers. If you're unsure about something, leave it out rather than guessing.
- Keep each answer concise: one or two short paragraphs or a short list, in plain language accessible to non-experts.
- Format answers as simple Markdown (paragraphs, lists, bold). No headings, no tables. Include links to documentation and other Our World in Data charts and articles only if they actually exist.

${describeAskChartContext(context)}`
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context
    const url = new URL(request.url)

    if (!env.OPENAI_API_KEY)
        return jsonError(
            503,
            "This feature is not available: missing OPENAI_API_KEY"
        )

    try {
        const slug = url.searchParams.get("slug") ?? ""
        if (!/^[a-zA-Z0-9_-]{1,150}$/.test(slug))
            throw new StatusError(400, "Invalid chart slug")

        const shouldCache = !url.searchParams.has("nocache")
        const cachedResponse = await checkCache(request, shouldCache)
        if (cachedResponse) return cachedResponse

        const chartContext = await buildAskChartContext(slug, env)

        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })
        const completion = await openai.responses.parse({
            model: getAskChartModel(env),
            instructions: buildFaqPrompt(chartContext),
            input: "Write the FAQ entries for this chart.",
            text: { format: zodTextFormat(FaqEntriesSchema, "chart_faqs") },
            store: false,
            max_output_tokens: MAX_OUTPUT_TOKENS,
            reasoning: { effort: "low" },
        })
        const parsed = completion.output_parsed
        if (!parsed?.faqs?.length)
            return jsonError(502, "The AI model did not return any FAQs")

        const response = Response.json(parsed, {
            headers: {
                "Cache-Control": shouldCache
                    ? `public, max-age=${CACHE_MAX_AGE_SECONDS}`
                    : "no-cache",
            },
        })
        if (shouldCache)
            context.waitUntil(caches.default.put(request, response.clone()))
        return response
    } catch (error) {
        if (error instanceof StatusError) {
            if (error.status === 404) return jsonError(404, "Chart not found")
            return jsonError(error.status, error.message ?? "Invalid request")
        }
        if (error instanceof OpenAI.APIError) {
            console.error("OpenAI API error:", error.status, error.message)
            Sentry.captureException(error)
            return jsonError(502, "The AI model could not be reached")
        }
        console.error("Ask-chart FAQ API error:", error)
        Sentry.captureException(error)
        return jsonError(500, "An error occurred while generating the FAQs")
    }
}
