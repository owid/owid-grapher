import { DbEnrichedImage, JsonError } from "@ourworldindata/types"
import pMap from "p-map"
import {
    validateImagePayload,
    processImageContent,
    uploadToCloudflare,
    deleteFromCloudflare,
} from "../imagesHelpers.js"
import { triggerStaticBuild } from "./routeUtils.js"
import * as db from "../../db/db.js"
import * as lodash from "lodash"

import { Request } from "../authentication.js"
import e from "express"
export async function getImagesHandler(
    _: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    try {
        const images = await db.getCloudflareImages(trx)
        res.set("Cache-Control", "no-store")
        res.send({ images })
    } catch (error) {
        console.error("Error fetching images", error)
        res.status(500).json({
            error: { message: String(error), status: 500 },
        })
    }
}

export async function postImageHandler(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const { filename, type, content } = validateImagePayload(req.body)

    const { asBlob, dimensions, hash } = await processImageContent(
        content,
        type
    )

    const collision = await trx<DbEnrichedImage>("images")
        .where({
            hash,
            replacedBy: null,
        })
        .first()

    if (collision) {
        return {
            success: false,
            error: `An image with this content already exists (filename: ${collision.filename})`,
        }
    }

    const preexisting = await trx<DbEnrichedImage>("images")
        .where("filename", "=", filename)
        .first()

    if (preexisting) {
        return {
            success: false,
            error: "An image with this filename already exists",
        }
    }

    const cloudflareId = await uploadToCloudflare(filename, asBlob)

    if (!cloudflareId) {
        return {
            success: false,
            error: "Failed to upload image",
        }
    }

    await trx<DbEnrichedImage>("images").insert({
        filename,
        originalWidth: dimensions.width,
        originalHeight: dimensions.height,
        cloudflareId,
        updatedAt: new Date().getTime(),
        userId: res.locals.user.id,
        hash,
    })

    const image = await db.getCloudflareImage(trx, filename)

    return {
        success: true,
        image,
    }
}
/**
 * Similar to the POST route, but for updating an existing image.
 * Creates a new image entry in the database and uploads the new image to Cloudflare.
 * The old image is marked as replaced by the new image.
 */
export async function putImageHandler(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const { type, content } = validateImagePayload(req.body)
    const { asBlob, dimensions, hash } = await processImageContent(
        content,
        type
    )
    const collision = await trx<DbEnrichedImage>("images")
        .where({
            hash,
            replacedBy: null,
        })
        .first()

    if (collision) {
        return {
            success: false,
            errorMessage: `An exact copy of this image already exists (filename: ${collision.filename})`,
        }
    }

    const { id } = req.params

    const image = await trx<DbEnrichedImage>("images")
        .where("id", "=", id)
        .first()

    if (!image) {
        throw new JsonError(`No image found for id ${id}`, 404)
    }

    const originalCloudflareId = image.cloudflareId
    const originalFilename = image.filename
    const originalAltText = image.defaultAlt

    if (!originalCloudflareId) {
        throw new JsonError(
            `Image with id ${id} has no associated Cloudflare image`,
            400
        )
    }

    const newCloudflareId = await uploadToCloudflare(originalFilename, asBlob)

    if (!newCloudflareId) {
        throw new JsonError("Failed to upload image", 500)
    }

    const [newImageId] = await trx<DbEnrichedImage>("images").insert({
        filename: originalFilename,
        originalWidth: dimensions.width,
        originalHeight: dimensions.height,
        cloudflareId: newCloudflareId,
        updatedAt: new Date().getTime(),
        userId: res.locals.user.id,
        defaultAlt: originalAltText,
        hash,
        version: image.version + 1,
    })

    await trx<DbEnrichedImage>("images").where("id", "=", id).update({
        replacedBy: newImageId,
    })

    const updated = await db.getCloudflareImage(trx, originalFilename)

    await triggerStaticBuild(
        res.locals.user,
        `Updating image "${originalFilename}"`
    )

    return {
        success: true,
        image: updated,
    }
}
// Update alt text via patch
export async function patchImageHandler(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const { id } = req.params

    const image = await trx<DbEnrichedImage>("images")
        .where("id", "=", id)
        .first()

    if (!image) {
        throw new JsonError(`No image found for id ${id}`, 404)
    }

    const patchableImageProperties = ["defaultAlt"] as const
    const patch = lodash.pick(req.body, patchableImageProperties)

    if (Object.keys(patch).length === 0) {
        throw new JsonError("No patchable properties provided", 400)
    }

    await trx("images").where({ id }).update(patch)

    const updated = await trx<DbEnrichedImage>("images")
        .where("id", "=", id)
        .first()

    return {
        success: true,
        image: updated,
    }
}

export async function deleteImageHandler(
    req: Request,
    _: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const { id } = req.params

    const image = await trx<DbEnrichedImage>("images")
        .where("id", "=", id)
        .first()

    if (!image) {
        throw new JsonError(`No image found for id ${id}`, 404)
    }
    if (!image.cloudflareId) {
        throw new JsonError(`Image does not have a cloudflare ID`, 400)
    }

    const replacementChain = await db.selectReplacementChainForImage(trx, id)

    await pMap(
        replacementChain,
        async (image) => {
            if (image.cloudflareId) {
                await deleteFromCloudflare(image.cloudflareId)
            }
        },
        { concurrency: 5 }
    )

    // There's an ON DELETE CASCADE which will delete the replacements
    await trx("images").where({ id }).delete()

    return {
        success: true,
    }
}

export async function getImageUsageHandler(
    _: Request,
    __: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const usage = await db.getImageUsage(trx)

    return {
        success: true,
        usage,
    }
}
