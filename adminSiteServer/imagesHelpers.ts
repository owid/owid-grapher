import crypto from "crypto"
import { JsonError } from "@ourworldindata/types"
import sharp from "sharp"
import {
    CLOUDFLARE_IMAGES_ACCOUNT_ID,
    CLOUDFLARE_IMAGES_API_KEY,
    OPENAI_API_KEY,
} from "../settings/serverSettings.js"
import { OpenAI } from "openai"
import { ACCEPTED_IMG_TYPES } from "../adminSiteClient/imagesHelpers.js"

export function validateImagePayload(body: any): {
    filename: string
    type: string
    content: string
} {
    const { filename, type, content } = body
    if (!filename || !type || !content) {
        throw new JsonError("Missing required fields", 400)
    }
    if (
        typeof filename !== "string" ||
        typeof type !== "string" ||
        typeof content !== "string"
    ) {
        throw new JsonError("Invalid field types", 400)
    }
    if (!ACCEPTED_IMG_TYPES.includes(type)) {
        throw new JsonError(`Unsupported image type: ${type}`, 400)
    }
    return { filename, type, content }
}

export async function processImageContent(
    content: string,
    type: string
): Promise<{
    asBlob: Blob
    dimensions: { width: number; height: number }
    hash: string
}> {
    const stripped = content.slice(content.indexOf(",") + 1)
    const asBuffer = Buffer.from(stripped, "base64")
    const hash = crypto.createHash("sha256").update(asBuffer).digest("hex")
    const asBlob = new Blob([asBuffer], { type })
    const { width, height } = await sharp(asBuffer)
        .metadata()
        .then(({ width, height }) => ({ width, height }))

    if (!width || !height) {
        throw new JsonError("Invalid image dimensions", 400)
    }

    return {
        asBlob,
        dimensions: {
            width,
            height,
        },
        hash,
    }
}

export async function uploadToCloudflare(filename: string, blob: Blob) {
    const body = new FormData()
    body.append("file", blob, filename)
    body.append("metadata", JSON.stringify({ filename }))
    body.append("requireSignedURLs", "false")

    console.log("Uploading image:", filename)
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v1`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${CLOUDFLARE_IMAGES_API_KEY}`,
            },
            body,
        }
    ).then((res) => res.json())

    if (response.errors.length) {
        if (response.errors.length === 1 && response.errors[0].code === 5409) {
            throw new JsonError(
                "An image with this filename already exists in Cloudflare Images but isn't tracked in the database. Please contact a developer for help."
            )
        }
        console.error("Error uploading image to Cloudflare:", response.errors)
        throw new JsonError(JSON.stringify(response.errors))
    }

    return response.result.id
}

export async function deleteFromCloudflare(cloudflareId: string) {
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v1/${
            cloudflareId
        }`,
        {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${CLOUDFLARE_IMAGES_API_KEY}`,
            },
        }
    ).then((res) => res.json())

    if (response.errors.length) {
        console.error("Error deleting image from Cloudflare:", response.errors)
        throw new JsonError(JSON.stringify(response.errors))
    }
}

export async function fetchGptGeneratedAltText(url: string) {
    const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
    })

    const completion = await openai.chat.completions.create({
        messages: [
            {
                role: "user",
                content: `Generate alt text for this image, describing it for a vision-impaired person using a screen reader.
- If it's a chart, use the Amy Cesal formula: "[Chart type] of [type of data] where [reason for including chart]"
- Keep it brief. Three sentences maximum.
- If there is too much data to describe, just give an overview of what the chart is showing, not specific data points.
- DO NOT mention colors unless the data doesn't make sense without them
- When describing a number range, write "X to Y" not "X-Y".
- If the image is a generic thumbnail or decorative, describe it in one short sentence.
- DO NOT describe data sources, licenses, or footer metadata.
Example 1: "Line chart of cumulative burnt area in Europe where the 2022 area is more than double the 2006 to 2021 average, and well above the range for the same period"
Example 2: "Changes in forest area by world region since 1990 is a set of bar charts overlaid on a world map to compare forest cover between 1990 and 2025 across different continents. The visualization highlights that while forest area has expanded in regions like Europe and North and Central America, it has significantly declined in South America and parts of Asia. Oceania is shown to have had no change in its total forest area over this period."`,
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
        model: "gpt-5-mini",
    })

    const content = completion.choices[0].message.content
    if (content) {
        // Sometimes the model still uses markdown bold even when told not to.
        return content.replaceAll("**", "")
    }
    return null
}

export interface TextExtractionResult {
    text: string | null
    usage: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
    } | null
}

export async function fetchGptGeneratedTextFromImage(
    url: string
): Promise<TextExtractionResult> {
    const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
    })

    const completion = await openai.chat.completions.create({
        messages: [
            {
                role: "user",
                content: `Extract all text from this image, including any text in the footer.
Do not use markdown in the text.
If the image is a data visualization, do not include numbers or data points or axis ticks, just the text annotations, footer text, titles, etc.
If there is no text in the image, return an empty string.`,
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
        model: "gpt-5-mini",
    })

    const content = completion.choices[0].message.content
    const usage = completion.usage
        ? {
              promptTokens: completion.usage.prompt_tokens,
              completionTokens: completion.usage.completion_tokens,
              totalTokens: completion.usage.total_tokens,
          }
        : null

    if (content !== null) {
        return {
            text: content.replaceAll(/\s+/g, " "),
            usage,
        }
    }

    return { text: null, usage }
}
