import {
    DbChartTagJoin,
    JsonError,
    DbEnrichedImage,
} from "@ourworldindata/types"
import { parseIntOrUndefined } from "@ourworldindata/utils"
import { getGptTopicSuggestions } from "../../db/model/Chart.js"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.js"
import { fetchGptGeneratedAltText } from "../imagesHelpers.js"
import * as db from "../../db/db.js"
import e from "express"
import { Request } from "../authentication.js"
import OpenAI from "openai"
import { OPENAI_API_KEY } from "../../settings/serverSettings.js"

export async function suggestGptTopics(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
): Promise<Record<"topics", DbChartTagJoin[]>> {
    const chartId = parseIntOrUndefined(req.params.chartId)
    if (!chartId) throw new JsonError(`Invalid chart ID`, 400)

    const topics = await getGptTopicSuggestions(trx, chartId)

    if (!topics.length)
        throw new JsonError(
            `No GPT topic suggestions found for chart ${chartId}`,
            404
        )

    return {
        topics,
    }
}

export async function suggestGptAltText(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
): Promise<{
    success: boolean
    altText: string | null
}> {
    const imageId = parseIntOrUndefined(req.params.imageId)
    if (!imageId) throw new JsonError(`Invalid image ID`, 400)
    const image = await trx<DbEnrichedImage>("images")
        .where("id", imageId)
        .first()
    if (!image) throw new JsonError(`No image found for ID ${imageId}`, 404)

    const src = `${CLOUDFLARE_IMAGES_URL}/${image.cloudflareId}/public`
    let altText: string | null = ""
    try {
        altText = await fetchGptGeneratedAltText(src)
    } catch (error) {
        console.error(`Error fetching GPT alt text for image ${imageId}`, error)
        throw new JsonError(`Error fetching GPT alt text: ${error}`, 500)
    }

    if (!altText) {
        throw new JsonError(`Unable to generate alt text for image`, 404)
    }

    return { success: true, altText }
}

export async function suggestDataPointDescription(
    req: Request
): Promise<string> {
    const { dataPoint, metadata } = req.body
    if (!dataPoint || !metadata) throw new JsonError(`Invalid input data`, 400)

    let description: string | null = ""
    try {
        description = await fetchGptDataPointDescription(dataPoint, metadata)
    } catch (error) {
        console.error(`Error fetching GPT sentence`, error)
        throw new JsonError(`Error fetching GPT sentence: ${error}`, 500)
    }

    if (!description) {
        throw new JsonError(`Unable to generate sentence`, 404)
    }

    return description
}

export async function fetchGptDataPointDescription(
    dataPoint: any,
    metadata: any
) {
    const prompt = `Given the data point ${JSON.stringify(dataPoint)} and metadata ${JSON.stringify(metadata)},
    generate a data point fact.
    - Do not add any information that is not directly supported by the data point and metadata.
    - Do not prefix the fact with "Data point:" or similar.`
    // console.log(prompt)
    const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
    })
    const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-4o-mini",
    })

    const description = completion.choices[0]?.message?.content
    if (!description) throw new JsonError("No response from GPT", 500)
    // console.log("Generated Description:", description)
    return description
}
