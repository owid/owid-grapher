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

const main = async () => {
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

                    // await trx("images").update({ hash }).where({ id: image.id })
                }
            },
            { concurrency: 20 }
        )

        console.log("Done!")
        console.log("Newly hashed:", counters.newHash)
        console.log("Unchanged:", counters.unchanged)
        console.log("Updated mismatches:", counters.mismatches)
    })
}

void main().then(() => process.exit())
