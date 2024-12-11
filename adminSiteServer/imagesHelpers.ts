import crypto from "crypto"
import { JsonError } from "@ourworldindata/types"
import sharp from "sharp"
import {
    CLOUDFLARE_IMAGES_ACCOUNT_ID,
    CLOUDFLARE_IMAGES_API_KEY,
    OPENAI_API_KEY,
} from "../settings/serverSettings.js"
import { OpenAI } from "openai"

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
                content: `Generate alt text for this image, describing it for a vision impaired person using a screen reader.
Do not say "alt text:".
Do not say "The image...".
If the image is a data visualization and there are data sources in the footer, describe them exhaustively.`,
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
        model: "gpt-4o-mini",
    })

    return completion.choices[0].message.content
}
