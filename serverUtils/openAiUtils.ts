import { z } from "zod"
import { makeParseableResponseFormat } from "openai/lib/parser"
import { OpenAI } from "openai"
import { OPENAI_API_KEY } from "../settings/serverSettings.js"
import crypto from "crypto"
import fs from "fs-extra"
import path from "path"

import type { AutoParseableResponseFormat } from "openai/lib/parser"
import type { ResponseFormatJSONSchema } from "openai/resources"

// Workaround: OpenAI doesn't currently support Zod v4, so we need to use a custom zodResponseFormat function
// see https://github.com/openai/openai-node/issues/1576#issuecomment-3056734414
export function zodResponseFormat<ZodInput extends z.ZodType>(
    zodObject: ZodInput,
    name: string,
    props?: Omit<
        ResponseFormatJSONSchema.JSONSchema,
        "schema" | "strict" | "name"
    >
): AutoParseableResponseFormat<z.infer<ZodInput>> {
    return makeParseableResponseFormat(
        {
            type: "json_schema",
            json_schema: {
                ...props,
                name,
                strict: true,
                schema: z.toJSONSchema(zodObject, { target: "draft-7" }),
            },
        },
        (content) => zodObject.parse(JSON.parse(content))
    )
}

// TODO: replace /x by slug
// TODO: use newer prompt
// Write a concise, neutral description for an interactive visualization. Follow these rules:
// - Begin with a statement of what the visualization shows.
// - If the visualization depicts change over time, specify the time span on the horizontal axis and the unit of measurement on the vertical axis.
// - If the visualization is a map, state the year shown and the unit of measurement represented.
// - Do not mention a specific chart type (e.g., line, bar, map).
// - Provide a brief overview of what the visualization represents without interpreting or analyzing patterns.
// - Include a short explanation of why the metric is significant or relevant.
// - Do not reference specific countries, regions, or entities, since these may vary depending on the chart view.
// - Conclude with an attribution in the format: "Source: OurWorldInData.org/x"
const GPT_PROMPT = `
Write a concise description for an interactive visualization. The description should:
- Start with a neutral statement of what the visualization displays.
- If the visualization shows change over time, indicate the time span on the horizontal axis and the unit of measurement on the vertical axis. If it is a map, indicate the year shown and the unit of measurement represented by color.
- Provide a brief summary of what the visualization represents overall, without interpreting or analyzing trends.
- Include a short explanation of why this metric is significant or relevant.
- Avoid mentioning specific countries, regions, or entities, since these may vary with the chart view.
- Conclude with an attribution line in the format: "Source: OurWorldInData.org/x"
- Do not use markdown in the text.
`

const CACHE_DIR = path.join(process.cwd(), ".gpt-cache")

// Hash the prompt + URL to create a cache key
function getCacheKey(url: string, prompt: string): string {
    const hash = crypto
        .createHash("sha256")
        .update(JSON.stringify({ url, prompt }))
        .digest("hex")
    return hash
}

export async function fetchGptGeneratedAltText(url: string) {
    const cacheKey = getCacheKey(url, GPT_PROMPT)
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`)

    // Check cache first
    if (await fs.pathExists(cacheFile)) {
        const cached = await fs.readJson(cacheFile)
        console.log(`Using cached GPT description for ${url}`)
        return cached.content
    }

    // Not in cache, fetch from OpenAI
    const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
    })

    const completion = await openai.chat.completions.create({
        messages: [
            {
                role: "user",
                content: GPT_PROMPT,
            },
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url,
                        },
                    },
                ],
            },
        ],
        model: "gpt-5-nano",
    })

    // Calculate cost based on gpt-5-nano pricing
    // Input: $0.150 per 1M tokens, Output: $0.600 per 1M tokens
    const usage = completion.usage
    const inputCost = usage ? (usage.prompt_tokens / 1_000_000) * 0.15 : 0
    const outputCost = usage ? (usage.completion_tokens / 1_000_000) * 0.6 : 0
    const totalCost = inputCost + outputCost

    console.log(
        `GPT API call for ${url}: ${usage?.prompt_tokens || 0} input tokens, ${usage?.completion_tokens || 0} output tokens, cost: $${totalCost.toFixed(6)}`
    )

    const content = completion.choices[0].message.content
    if (content) {
        // Sometimes the model still uses markdown bold even when told not to.
        const cleanedContent = content.replaceAll("**", "")

        // Save to cache
        await fs.ensureDir(CACHE_DIR)
        await fs.writeJson(cacheFile, {
            url,
            prompt: GPT_PROMPT,
            content: cleanedContent,
            timestamp: new Date().toISOString(),
            cost: totalCost,
            usage: {
                promptTokens: usage?.prompt_tokens || 0,
                completionTokens: usage?.completion_tokens || 0,
            },
        })

        console.log(`Cached GPT description for ${url}`)
        return cleanedContent
    }
    return null
}
