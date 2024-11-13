import * as readline from "readline"
import pMap from "p-map"
import path from "path"
import fs from "fs/promises"
import { DbEnrichedImage } from "@ourworldindata/types"
import * as db from "../../db/db.js"
import {
    CLOUDFLARE_IMAGES_ACCOUNT_ID,
    CLOUDFLARE_IMAGES_API_KEY,
    IMAGE_HOSTING_R2_CDN_URL,
} from "../../settings/serverSettings.js"
import { excludeNullish, keyBy } from "@ourworldindata/utils"

type CloudflareImageDirectory = Record<string, { id: string; filename: string }>

enum InvalidImageReason {
    InvalidFormat = "InvalidFormat",
    InvalidDimensions = "InvalidDimensions",
    TooManyMegapixels = "TooManyMegapixels",
    InvalidMetadata = "InvalidMetadata",
    UnknownError = "UnknownError",
}

type ImageValidationObject = {
    filename: string
    reason: InvalidImageReason
    extra?: any
}

type CloudflareAPIResponseInfo = {
    code: number
    message: string
}

type CloudflareAPIDeleteResponse = {
    result: any
    errors: CloudflareAPIResponseInfo[]
    messages: CloudflareAPIResponseInfo[]
    success: boolean
}

type CloudflareAPIUploadResponse = {
    errors: CloudflareAPIResponseInfo[]
    messages: CloudflareAPIResponseInfo[]
    result: {
        id?: string
        filename?: string
        meta?: {
            key: string
        }
        requireSignedURLs?: boolean
        uploaded?: string
        variants?: string[]
    }
    success: boolean
}

function stringifyImageMetadata(image: DbEnrichedImage) {
    return JSON.stringify({
        filename: image.filename,
    })
}

/**
 * Make sure that each database cloudflareId corresponds to a valid image in the Cloudflare Images directory
 */
async function validateDirectory(
    trx: db.KnexReadWriteTransaction,
    directory: CloudflareImageDirectory
): Promise<{ isValid: boolean; invalidImages: string[] }> {
    const imagesWithIds = await db.knexRaw<{
        filename: string
        cloudflareId: string
    }>(
        trx,
        `-- sql
        SELECT filename, cloudflareId FROM images WHERE cloudflareId IS NOT NULL`
    )

    const invalidImages: string[] = []
    for (const image of imagesWithIds) {
        if (!directory[image.filename]) {
            invalidImages.push(image.filename)
        }
    }
    return {
        isValid: invalidImages.length === 0,
        invalidImages,
    }
}

async function purgeRecords(trx: db.KnexReadWriteTransaction) {
    await new Promise<void>((resolve) => {
        const readlineInterface = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        })

        readlineInterface.question(
            "Are you sure you want to delete ALL images from Cloudflare Images? (y/n) ",
            (answer) => {
                if (answer.toLowerCase() === "y") {
                    console.log("May God have mercy on your soul.")
                    resolve()
                } else {
                    console.log("Aborting.")
                    process.exit(0)
                }
                readlineInterface.close()
            }
        )
    })

    const directory = await getCloudflareImageDirectory()
    console.log("Deleting all images from Cloudflare Images...")
    await pMap(
        Object.values(directory),
        async (image) => {
            console.log("Deleting image:", image.filename)
            try {
                await fetch(
                    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v1/${encodeURIComponent(image.id)}`,
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${CLOUDFLARE_IMAGES_API_KEY}`,
                        },
                    }
                )
                    .then((res) => res.json())
                    .then((res: CloudflareAPIDeleteResponse) => {
                        if (res.success) {
                            console.log("Image deleted:", image.filename)
                        } else {
                            console.error(
                                "Error deleting image:",
                                image.filename,
                                res.errors
                            )
                        }
                    })
            } catch (e) {
                console.error(e)
            }
        },
        { concurrency: 6 }
    )
    console.log("Finished")

    await new Promise<void>((resolve) => {
        const readlineInterface = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        })

        readlineInterface.question(
            "Would you also like to set all cloudflareIds to NULL in the DB? (y/n) ",
            (answer) => {
                if (answer.toLowerCase() === "y") {
                    resolve()
                } else {
                    console.log("Aborting.")
                    process.exit(0)
                }
                readlineInterface.close()
            }
        )
    })

    await db.knexRaw(
        trx,
        `-- sql
        UPDATE images
        SET cloudflareId = NULL`
    )
    console.log("All cloudflareIds set to NULL in the DB.")
}

/**
 *  Cloudflare has a width/height of 12000px, metadata of 1024B, 100megapixels, and a 10MB filesize limit
 */
function validateImage(
    image: DbEnrichedImage,
    metadata: string
): InvalidImageReason | null {
    if (!image.filename.match(/\.(png|jpg|jpeg|gif|webp)$/)) {
        return InvalidImageReason.InvalidFormat
    }

    if (!image.originalWidth || !image.originalHeight) {
        return InvalidImageReason.InvalidFormat
    }

    if (image.originalWidth > 12000 || image.originalHeight > 12000) {
        return InvalidImageReason.InvalidDimensions
    }

    if (image.originalWidth * image.originalHeight > 100 * 1000000) {
        return InvalidImageReason.TooManyMegapixels
    }

    if (Buffer.byteLength(metadata, "utf8") > 1024) {
        return InvalidImageReason.InvalidMetadata
    }

    return null
}

async function checkIfAlreadyUploadedToCloudflareImages(
    filename: string,
    cloudflareImagesDirectory: CloudflareImageDirectory
): Promise<boolean> {
    if (cloudflareImagesDirectory[filename]) {
        console.log("Already in Cloudflare Images:", filename)
        return true
    }
    return false
}

async function checkIfAlreadyTrackedInDB(
    trx: db.KnexReadWriteTransaction,
    filename: string
) {
    const cloudflareId = await trx
        .raw<{ cloudflareId: string }[][]>(
            `-- sql
            SELECT cloudflareId FROM images WHERE filename = ?`,
            [filename]
        )
        .then((res) => res[0][0]?.cloudflareId)
    if (!cloudflareId) {
        console.log("Not tracked in DB:", filename)
        return false
    } else {
        console.log("Already tracked in DB:", filename)
        return true
    }
}

async function updateDbWithCloudflareId(
    trx: db.KnexReadWriteTransaction,
    filename: string,
    cloudflareId: string
) {
    console.log("Updating the DB with the Cloudflare ID...")
    await trx.raw(
        `-- sql
        UPDATE images
        SET cloudflareId = ?
        WHERE filename = ?`,
        [cloudflareId, filename]
    )
}

async function uploadImageToCloudflareImages(
    trx: db.KnexReadWriteTransaction,
    image: DbEnrichedImage,
    invalidImages: ImageValidationObject[],
    cloudflareImagesDirectory: CloudflareImageDirectory
) {
    const filename = image.filename

    /**
     * If the image is already tracked in the DB, we don't need to do anything.
     * If the image is already uploaded to Cloudflare Images, we check if we need to update the DB with the cloudflareId.
     * It's possible the image has already been uploaded but is saved under a different filename,
     * in which case we go through the normal process of uploading the image,
     * which is a no-op for Cloudflare, but will give us the right ID to update the DB with.
     */
    const alreadyTracked = await checkIfAlreadyTrackedInDB(trx, filename)
    const alreadyUploaded = await checkIfAlreadyUploadedToCloudflareImages(
        filename,
        cloudflareImagesDirectory
    )
    if (alreadyTracked) {
        return
    }
    if (alreadyUploaded) {
        const cloudflareId = cloudflareImagesDirectory[filename].id
        await updateDbWithCloudflareId(trx, filename, cloudflareId)
        return
    }

    const imageUrl = `${IMAGE_HOSTING_R2_CDN_URL}/production/${filename}`
    const metadata = stringifyImageMetadata(image)
    const invalidReason = validateImage(image, metadata)
    if (invalidReason) {
        console.log("Image invalid:", filename)
        invalidImages.push({
            filename,
            reason: invalidReason,
        })
        return
    }

    const formData = new FormData()
    formData.append("url", imageUrl)
    formData.append("id", encodeURIComponent(filename))
    formData.append("metadata", metadata)
    formData.append("requireSignedURLs", "false")

    console.log("Uploading image:", filename)
    const uploadResults = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v1`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${CLOUDFLARE_IMAGES_API_KEY}`,
            },
            body: formData,
        }
    )
        .then((res) => res.json())
        .then((res: CloudflareAPIUploadResponse) => {
            if (res.success) {
                console.log("Upload complete:", filename)
            } else {
                console.error("Upload error:", filename, res.errors)
            }
            return res
        })

    if (!uploadResults || uploadResults.errors.length) {
        invalidImages.push({
            filename,
            reason: InvalidImageReason.UnknownError,
            extra: uploadResults.errors,
        })
        return
    }

    await trx.raw(
        `-- sql
        UPDATE images
        SET cloudflareId = ?
        WHERE filename = ?`,
        [uploadResults.result.id, filename]
    )
}

async function getCloudflareImageDirectory() {
    console.log("Fetching Cloudflare Images directory...")
    const directory = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v1?per_page=2000`,
        {
            headers: {
                Authorization: `Bearer ${CLOUDFLARE_IMAGES_API_KEY}`,
            },
        }
    )
        .then((res) => res.json())
        .then((res) => {
            console.log(
                `Cloudflare Images directory fetched. ${res.result.images.length} images found.`
            )
            return res.result.images
        })
        .then(
            (images) =>
                keyBy(images, (image) =>
                    decodeURIComponent(image.filename)
                ) as CloudflareImageDirectory
        )

    return directory
}

async function fetchImagesFromDatabase(trx: db.KnexReadWriteTransaction) {
    console.log("Fetching images from the database...")
    return await trx
        .raw<DbEnrichedImage[]>(
            `-- sql
            SELECT * FROM images WHERE id IN (
                SELECT DISTINCT imageId FROM posts_gdocs_x_images
            )`
        )
        .then((res) => res.flat())
        .then(excludeNullish)
        .then((images) => images.filter((image) => image && image.filename))
        .then((images) =>
            images.sort((a, b) => a.filename.localeCompare(b.filename))
        )
}

async function uploadImagesToCloudflareImages(
    trx: db.KnexReadWriteTransaction,
    cloudflareImagesDirectory: CloudflareImageDirectory
) {
    const invalidImages: ImageValidationObject[] = []

    const images = await fetchImagesFromDatabase(trx)

    console.log(`${images.length} images fetched.`)

    await pMap(
        images,
        async (image) => {
            console.log(`Processing image: ${image.filename}`)
            try {
                await uploadImageToCloudflareImages(
                    trx,
                    image,
                    invalidImages,
                    cloudflareImagesDirectory
                )
            } catch (e) {
                console.error(e)
                invalidImages.push({
                    filename: image.filename,
                    reason: InvalidImageReason.UnknownError,
                    extra: e,
                })
            }
        },
        { concurrency: 6 }
    )

    console.log("Finished!")
    console.log(
        `There were ${invalidImages.length} invalid images. See invalidImages.json for details.`
    )

    await fs.writeFile(
        path.join(__dirname, "invalidImages.json"),
        JSON.stringify(invalidImages, null, 2)
    )
}

async function main() {
    if (!CLOUDFLARE_IMAGES_ACCOUNT_ID || !CLOUDFLARE_IMAGES_API_KEY) {
        console.error(
            `Cloudflare Images credentials not set. 
You need to set "CLOUDFLARE_IMAGES_ACCOUNT_ID" and "CLOUDFLARE_IMAGES_API_KEY" in your .env`
        )
        return
    }

    await db.knexReadWriteTransaction(async (trx) => {
        // await purgeRecords(trx)

        const directory = await getCloudflareImageDirectory()
        const { isValid, invalidImages } = await validateDirectory(
            trx,
            directory
        )
        if (isValid) {
            await uploadImagesToCloudflareImages(trx, directory)
        } else {
            console.error(
                `The DB has images that do not exist in the Cloudflare Images directory. You should check those out first`
            )
            console.error(invalidImages)
        }
    })
}

main().then(() => process.exit(0))
