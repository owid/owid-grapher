import { JsonError } from "@ourworldindata/types"
import { Request } from "express"
import * as e from "express"
import * as db from "../../db/db.js"
import * as Figma from "figma-api"
import { FIGMA_API_KEY } from "../../settings/serverSettings.js"

const figmaApi = new Figma.Api({ personalAccessToken: FIGMA_API_KEY })

export async function getFigmaImageUrl(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    _trx: db.KnexReadonlyTransaction
) {
    const { fileId, nodeId } = req.query

    if (!fileId || !nodeId) throw new JsonError("fileId or nodeId missing")

    // Request the image URL from Figma
    const imageMap = await figmaApi.getImages(
        { file_key: fileId },
        { ids: [nodeId], scale: 3 }
    )
    if (!imageMap || imageMap.err !== null)
        throw new JsonError("Failed to fetch image map from Figma")

    // Grab the image URL from the image map
    const imageUrl = imageMap.images[nodeId]
    if (!imageUrl)
        throw new JsonError("Figma's image map does not contain the image")

    return { success: true, imageUrl }
}
