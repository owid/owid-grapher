const is = require("image-size")
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
    TooLarge = "TooLarge",
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
    const imagesSharingCloudflareIds = await db
        .knexRaw<{
            cloudflareId: string
            count: number
            filenames: string
        }>(
            trx,
            `-- sql
        SELECT 
            cloudflareId,
            COUNT(*) as count,
            JSON_ARRAYAGG(
                filename
            ) as filenames
        FROM images
        WHERE cloudflareId IS NOT NULL
        GROUP BY cloudflareId
        HAVING count > 1`
        )
        .then((results) =>
            results.map((result) => ({
                cloudflareId: result.cloudflareId,
                count: result.count,
                filenames: JSON.parse(result.filenames) as string[],
            }))
        )
        .then((results) => keyBy(results, "cloudflareId"))

    const invalidImages: string[] = []
    for (const image of imagesWithIds) {
        if (!directory[image.filename]) {
            // If an identical image was uploaded with multiple filenames, subsequent copies will use the same cloudflareId as the first
            // so let's check if this is a case of that
            const imagesSharingCloudflareId =
                imagesSharingCloudflareIds[image.cloudflareId]
            if (imagesSharingCloudflareId) {
                const filenames = imagesSharingCloudflareId.filenames
                if (filenames.includes(image.filename)) {
                    console.log(
                        `Image with filename "${image.filename}" has a cloudflareId that is shared with other images.`
                    )
                    continue
                }
            }
            console.log(
                `Image with filename "${image.filename}" has a cloudflareId that is not in the Cloudflare Images directory.`
            )
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
                    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v2/${image.id}`,
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${CLOUDFLARE_IMAGES_API_KEY}`,
                        },
                    }
                )
            } catch (e) {
                console.error(e)
            }
        },
        { concurrency: 10 }
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
    console.log("May God have mercy on your soul.")

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
    imageBuffer: Buffer,
    metadata: string
): InvalidImageReason | null {
    const imageSize = is(imageBuffer)
    if (!imageSize) {
        return InvalidImageReason.InvalidFormat
    }

    if (imageSize.width > 12000 || imageSize.height > 12000) {
        return InvalidImageReason.InvalidDimensions
    }

    if (imageSize.width * imageSize.height > 100 * 1000000) {
        return InvalidImageReason.TooManyMegapixels
    }

    if (imageBuffer.byteLength > 10 * 1024 * 1024) {
        return InvalidImageReason.TooLarge
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
        console.log(
            `Image with filename "${filename}" has already uploaded to Cloudflare Images.`
        )
        return true
    }
    return false
}

async function checkIfAlreadyTrackedInDB(
    trx: db.KnexReadWriteTransaction,
    filename: string
) {
    console.log("Checking to see if the DB has the Cloudflare ID...")
    const cloudflareId = await trx
        .raw<{ cloudflareId: string }[][]>(
            `-- sql
                SELECT cloudflareId FROM images WHERE filename = ?
                `,
            [filename]
        )
        .then((res) => res[0][0]?.cloudflareId)
    if (!cloudflareId) {
        console.log("No Cloudflare ID found in the DB.")
        return false
    } else {
        console.log(`Cloudflare ID "${cloudflareId}" exists in the DB.`)
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
    console.log("Downloading image:", filename)
    const imageBuffer = await fetch(imageUrl).then((res) => res.arrayBuffer())
    const metadata = stringifyImageMetadata(image)
    const isInvalid = validateImage(Buffer.from(imageBuffer), metadata)
    if (isInvalid) {
        console.log(`Image "${filename}" is invalid: ${isInvalid}`)
        invalidImages.push({
            filename,
            reason: isInvalid,
        })
        return
    }

    const formData = new FormData()
    formData.append("url", imageUrl)
    formData.append("metadata", metadata)
    formData.append("requireSignedURLs", "false")

    console.log("Uploading image to Cloudflare Images...")
    const uploadResults = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v1`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${CLOUDFLARE_IMAGES_API_KEY}`,
            },
            body: formData,
        }
    ).then((res) => res.json())

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
                WHERE googleId = ?`,
        [uploadResults.result.id, image.googleId]
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
        { concurrency: 10 }
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
