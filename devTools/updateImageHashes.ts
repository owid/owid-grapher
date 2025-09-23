/**
 * This script fetches all images from Cloudflare, computes their SHA-256 hashes,
 * and updates the database if the hash is missing or incorrect.
 *
 * There are some cases where the hash in the DB cannot be reproduced, and for
 * these ones we (Marcel and Ike) are not entirely sure why. It might be that
 * Cloudflare doesn't give us back the original image as-is for some reason.
 *
 * This script runs in dry-run mode by default. Use the --fix flag to actually
 * update the database.
 */

import { createHash } from "crypto"
import * as db from "../db/db.js"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings.js"
import pMap from "p-map"
import { DbEnrichedImage } from "@ourworldindata/types"

const counters = {
    newHash: 0,
    unchanged: 0,
    mismatches: 0,
}

const main = async ({ shouldFix }: { shouldFix: boolean }) => {
    console.log("Starting image hash update...")
    if (!shouldFix)
        console.log(
            "Running in dry-run mode. Use --fix to update the database."
        )

    await db.knexReadWriteTransaction(async (trx) => {
        const images = await db.knexRaw<DbEnrichedImage>(
            trx,
            `SELECT * FROM images`
        )

        await pMap(
            images,
            async (image) => {
                const url = `${CLOUDFLARE_IMAGES_URL}/${image.cloudflareId}/w=${image.originalWidth}`

                // If the image is a webp, we need to explicitly send an Accept header along to get the original file
                const isWebp = image.filename.toLowerCase().endsWith(".webp")
                const headers = new Headers(
                    isWebp ? { Accept: "image/webp" } : {}
                )

                const img = await fetch(url, {
                    headers,
                }).then((res) => res.blob())

                const arrBuffer = await img.arrayBuffer()
                const buffer = Buffer.from(arrBuffer)

                const hash = createHash("sha256").update(buffer).digest("hex")

                if (image.hash === hash) {
                    counters.unchanged++
                } else {
                    if (!image.hash) counters.newHash++
                    else {
                        counters.mismatches++
                        console.log("Hash mismatch!", {
                            id: image.id,
                            filename: image.filename,
                            oldHash: image.hash,
                            newHash: hash,
                        })
                    }

                    if (shouldFix) {
                        await trx("images")
                            .update({ hash })
                            .where({ id: image.id })
                    } else {
                        // dry-run: do not update DB
                    }
                }
            },
            { concurrency: 20 }
        )

        console.log("Done!")
        console.log(
            "Images that didn't previously have a hash:",
            counters.newHash
        )
        console.log("Images where the hash matched:", counters.unchanged)
        console.log("Images where the hash didn't match:", counters.mismatches)

        if (!shouldFix)
            console.log(
                "Didn't actually update the database. Run again with --fix to do so."
            )
        else console.log("Hashes in the database have been updated.")
    })
}

const shouldFix = process.argv.includes("--fix")

void main({ shouldFix }).then(() => process.exit())
