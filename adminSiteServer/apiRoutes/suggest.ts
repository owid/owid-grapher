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

export async function suggestGptAltTextForCloudflareImage(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
): Promise<{
    success: true
    altText: string
}> {
    const imageId = parseIntOrUndefined(req.params.imageId)
    if (!imageId) throw new JsonError(`Invalid image ID`, 400)
    const image = await trx<DbEnrichedImage>("images")
        .where("id", imageId)
        .first()
    if (!image) throw new JsonError(`No image found for ID ${imageId}`, 404)

    const imageUrl = `${CLOUDFLARE_IMAGES_URL}/${image.cloudflareId}/public`
    const response = await generateAltTextFromUrl(imageUrl)

    return response
}

export async function suggestGptAltText(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    _trx: db.KnexReadonlyTransaction
): Promise<{
    success: true
    altText: string
}> {
    const imageUrl = req.query.imageUrl
    if (!imageUrl) throw new JsonError(`No image URL provided`, 400)
    if (typeof imageUrl !== "string")
        throw new JsonError(`Invalid image URL provided`, 400)
    const response = await generateAltTextFromUrl(imageUrl as string)
    return response
}

export async function generateAltTextFromUrl(imageUrl: string): Promise<{
    success: true
    altText: string
}> {
    let altText: string | null = ""
    try {
        altText = await fetchGptGeneratedAltText(imageUrl)
    } catch (error) {
        console.error(
            `Error fetching GPT alt text for image at ${imageUrl}`,
            error
        )
        throw new JsonError(`Error fetching GPT alt text: ${error}`, 500)
    }

    if (!altText) {
        throw new JsonError(`Unable to generate alt text for image`, 404)
    }

    return { success: true, altText }
}
