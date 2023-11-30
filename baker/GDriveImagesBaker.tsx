import fs from "fs-extra"
import path from "path"
import * as db from "../db/db.js"
import {
    IMAGE_HOSTING_CDN_URL,
    IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH,
} from "../settings/serverSettings.js"

import {
    ImageMetadata,
    getFilenameAsPng,
    retryPromise,
} from "@ourworldindata/utils"
import { Image } from "../db/model/Image.js"
import sharp from "sharp"
import pMap from "p-map"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"

export const bakeDriveImages = async (bakedSiteDir: string) => {
    // Get all GDocs images, download locally and resize them
    const images: Image[] = await db
        .queryMysql(
            `SELECT * FROM images WHERE id IN (SELECT DISTINCT imageId FROM posts_gdocs_x_images)`
        )
        .then((results: ImageMetadata[]) =>
            results.map((result) => Image.create<Image>(result))
        )

    const imagesDirectory = path.join(bakedSiteDir, "images", "published")

    // If this causes timeout errors, try decreasing concurrency (2 should be safe)
    await pMap(
        images,
        async (image) => {
            const remoteFilePath = path.join(
                IMAGE_HOSTING_CDN_URL,
                IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH,
                image.filename
            )
            const localImagePath = path.join(imagesDirectory, image.filename)
            const localImageEtagPath = localImagePath + ".etag"

            // If the image already exists locally, try to use its etag
            const existingEtag = await readEtagFromFile(
                localImagePath,
                localImageEtagPath
            )

            const response = await retryPromise(() =>
                fetch(remoteFilePath, {
                    headers: {
                        "If-None-Match": existingEtag,
                    },
                })
            )

            // Image has not been modified, skip
            if (response.status === 304) {
                return
            }

            if (!response.ok) {
                throw new Error(
                    `Fetching image failed: ${response.status} ${response.statusText} ${response.url}`
                )
            }

            let buffer = Buffer.from(await response.arrayBuffer())

            if (!image.isSvg) {
                await Promise.all(
                    image.sizes!.map((width) => {
                        const localResizedFilepath = path.join(
                            imagesDirectory,
                            `${image.filenameWithoutExtension}_${width}.webp`
                        )
                        return sharp(buffer)
                            .resize(width)
                            .webp({
                                lossless: true,
                            })
                            .toFile(localResizedFilepath)
                    })
                )
            } else {
                // A PNG alternative to the SVG for the "Download image" link
                const pngFilename = getFilenameAsPng(image.filename)
                await sharp(buffer)
                    .resize(2000)
                    .png()
                    .toFile(path.join(imagesDirectory, pngFilename))

                // Import the site's webfonts
                const svg = buffer
                    .toString()
                    .replace(
                        /(<svg.*?>)/,
                        `$1<defs><style>@import url(${BAKED_BASE_URL}/fonts.css)</style></defs>`
                    )
                buffer = Buffer.from(svg)
            }
            // For SVG, and a non-webp fallback copy of the image
            await fs.writeFile(
                path.join(imagesDirectory, image.filename),
                buffer
            )

            // Save the etag to a sidecar
            await fs.writeFile(
                localImageEtagPath,
                readEtagFromHeader(response),
                "utf8"
            )
        },
        { concurrency: 5 }
    )
}

const readEtagFromHeader = (response: Response) => {
    const etag = response.headers.get("etag")
    if (!etag) {
        throw new Error("No etag header found")
    }
    // strip extra quotes from etag
    return etag.replace(/^"|"$/g, "")
}

const readEtagFromFile = async (
    localImagePath: string,
    localImageEtagPath: string
) => {
    let etag = await Promise.all([
        fs.exists(localImagePath),
        fs.exists(localImageEtagPath),
    ]).then(([exists, etagExists]) =>
        exists && etagExists ? fs.readFile(localImageEtagPath, "utf8") : ""
    )

    // DigitalOcean wraps etag in double quotes
    if (!etag.includes('"')) {
        etag = '"' + etag + '"'
    }

    return etag
}
