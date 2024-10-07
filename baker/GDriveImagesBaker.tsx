import fs from "fs-extra"
import path from "path"
import * as db from "../db/db.js"
import {
    IMAGE_HOSTING_R2_CDN_URL,
    IMAGE_HOSTING_R2_BUCKET_SUBFOLDER_PATH,
} from "../settings/serverSettings.js"

import {
    DbRawImage,
    getFilenameAsPng,
    parseImageRow,
    retryPromise,
} from "@ourworldindata/utils"
import { Image } from "../db/model/Image.js"
import sharp from "sharp"
import pMap from "p-map"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"

export const bakeDriveImages = async (
    knex: db.KnexReadonlyTransaction,
    bakedSiteDir: string
) => {
    // Get all GDocs images, download locally and resize them
    const images: Image[] = await db
        .knexRaw<DbRawImage>(
            knex,
            `SELECT DISTINCT *
             FROM images
             WHERE id IN (SELECT DISTINCT imageId FROM posts_gdocs_x_images)
                OR filename IN (SELECT DISTINCT relatedLinkThumbnail FROM posts_gdocs_tombstones)`
        )
        .then((results) =>
            results.map((result) => new Image(parseImageRow(result)))
        )

    const imagesDirectory = path.join(bakedSiteDir, "images", "published")

    // TODO 2024-02-29: In the retrospective about a recent resized image bug in prod we
    //                  discussed a few improvements to make to this code:
    //                  - [ ] Add etags for all the resizes so that we are checking if all
    //                        the sizes are up to date, not just the original image.
    //                  - [ ] Clarify the filenames of the paths involved so that it is clear
    //                        what refers to the original image, the local version, ...
    //                  - [ ] Break this function into smaller functions to make it easier to
    //                        understand and maintain.

    // If this causes timeout errors, try decreasing concurrency (2 should be safe)
    await pMap(
        images,
        async (image) => {
            const remoteFilePath = path.join(
                IMAGE_HOSTING_R2_CDN_URL,
                IMAGE_HOSTING_R2_BUCKET_SUBFOLDER_PATH,
                image.filename
            )
            const localImagePath = path.join(imagesDirectory, image.filename)
            const localImageEtagPath = localImagePath + ".etag"

            // If the image already exists locally, try to use its etag
            const existingEtag = await readEtagFromFile(
                localImagePath,
                localImageEtagPath
            )

            const response = await retryPromise(
                () =>
                    fetch(remoteFilePath, {
                        headers: {
                            // XXX hotfix: force png rebuild every time, to work around missing png size variants on prod
                            // "If-None-Match": existingEtag,
                        },
                    }).then((response) => {
                        if (response.status === 304) {
                            // Image has not been modified, skip without logging
                            return response
                        } else if (response.ok) {
                            // Log fetched images if it was success but wasn't 304
                            console.log(
                                `Fetching image ${image.filename} from ${remoteFilePath} using etag ${existingEtag}...`
                            )
                            return response
                        } else {
                            // If the response status is 404, throw an error to trigger retry
                            const msg = `Fetching image failed: ${response.status} ${response.statusText} ${response.url}`
                            console.log(msg)
                            throw new Error(msg)
                        }
                    }),
                { maxRetries: 5, exponentialBackoff: true, initialDelay: 1000 }
            )

            // Image has not been modified, skip
            // XXX hotfix: force png rebuild every time, to work around missing png size variants on prod
            // if (response.status === 304) {
            //     return
            // }

            let buffer = Buffer.from(await response.arrayBuffer())

            if (!image.isSvg) {
                // Save the original image
                await fs.writeFile(
                    path.join(imagesDirectory, image.filename),
                    buffer
                )
                // Save resized versions
                await Promise.all(
                    image.sizes!.map((width) => {
                        const localResizedFilepath = path.join(
                            imagesDirectory,
                            `${image.filenameWithoutExtension}_${width}.png`
                        )
                        return sharp(buffer)
                            .resize(width)
                            .png()
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
                // Save the svg
                await fs.writeFile(
                    path.join(imagesDirectory, image.filename),
                    buffer
                )
            }

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
