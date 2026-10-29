/**
 * Backfill script to extract text from images with a vision model.
 *
 * Usage:
 *   # Test with a single image (dry-run)
 *   yarn tsx devTools/extractImageText.ts --id 123
 *
 *   # Backfill all images missing extractedText
 *   yarn tsx devTools/extractImageText.ts --all --fix
 */

import pMap from "p-map"
import { calcPrice, type PriceCalculationResult } from "@pydantic/genai-prices"
import * as db from "../db/db.js"
import { TransactionCloseMode } from "../db/db.js"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings.mjs"
import { DbEnrichedImage } from "@ourworldindata/types"
import {
    fetchGeneratedTextFromImage,
    TEXT_EXTRACTION_MODEL,
    TextExtractionResult,
} from "../adminSiteServer/imagesHelpers.js"

function calculateCost(
    usage: TextExtractionResult["usage"]
): PriceCalculationResult {
    return calcPrice(usage, TEXT_EXTRACTION_MODEL, { providerId: "anthropic" })
}

function estimateCost(usage: TextExtractionResult["usage"]): string {
    const tokens = `${usage.input_tokens} input + ${usage.output_tokens} output tokens`
    const price = calculateCost(usage)
    if (!price)
        return `unknown (no price for ${TEXT_EXTRACTION_MODEL}) (${tokens})`

    return `$${price.total_price.toFixed(6)} (${tokens})`
}

function parseArgs() {
    const args = process.argv.slice(2)
    const parsed = {
        id: undefined as number | undefined,
        all: false,
        fix: false,
    }

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case "--id":
                parsed.id = parseInt(args[++i], 10)
                break
            case "--all":
                parsed.all = true
                break
            case "--fix":
                parsed.fix = true
                break
        }
    }

    if (!parsed.id && !parsed.all) {
        console.error(
            "Please specify --id <imageId> for a single image or --all for all images."
        )
        process.exit(1)
    }

    return parsed
}

const BATCH_SIZE = 50
const CONCURRENCY = 10
const PAUSE_BETWEEN_BATCHES_MS = 5000

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

interface ImageResult {
    image: DbEnrichedImage
    text: string | null
    usage: TextExtractionResult["usage"]
    /** null when there is no price for the model */
    cost: number | null
}

async function processImage(image: DbEnrichedImage): Promise<ImageResult> {
    const url = `${CLOUDFLARE_IMAGES_URL}/${image.cloudflareId}/public`
    const { text, usage } = await fetchGeneratedTextFromImage(url)

    const cost = calculateCost(usage)?.total_price ?? null

    return { image, text, usage, cost }
}

function logResult(result: ImageResult, fix: boolean): void {
    console.log(`\n--- Image ${result.image.id}: ${result.image.filename} ---`)
    console.log(`  Cost: ${estimateCost(result.usage)}`)

    if (result.text !== null) {
        console.log(`  Extracted text: ${result.text}`)
        if (fix) {
            console.log(`  Saved to database.`)
        } else {
            console.log(`  (dry-run, not saving. Use --fix to write to DB)`)
        }
    } else {
        console.log(`  No text extracted.`)
    }
}

const main = async () => {
    const { id, all, fix } = parseArgs()

    console.log(`Mode: ${fix ? "WRITE" : "dry-run"}`)

    if (id) {
        const image = await db.knexReadWriteTransaction(async (trx) => {
            return trx<DbEnrichedImage>("images").where("id", id).first()
        }, TransactionCloseMode.Close)
        if (!image) {
            console.error(`No image found with id ${id}`)
            process.exit(1)
        }
        const result = await processImage(image)
        logResult(result, fix)
        if (fix && result.text !== null) {
            await db.knexReadWriteTransaction(async (trx) => {
                await trx("images")
                    .where({ id: image.id })
                    .update({ extractedText: result.text })
            }, TransactionCloseMode.Close)
        }
        return
    }

    if (!all) return

    const images = await db.knexReadWriteTransaction(async (trx) => {
        return db.knexRaw<DbEnrichedImage>(
            trx,
            `SELECT * FROM images WHERE replacedBy IS NULL AND extractedText IS NULL AND cloudflareId IS NOT NULL`
        )
    }, TransactionCloseMode.Close)
    console.log(`Found ${images.length} images without extracted text.`)

    let totalCost = 0
    let unpricedImages = 0
    const totalBatches = Math.ceil(images.length / BATCH_SIZE)

    for (let b = 0; b < totalBatches; b++) {
        const batch = images.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE)

        console.log(
            `\n=== Batch ${b + 1}/${totalBatches} (${batch.length} images) ===`
        )

        const results = await pMap(batch, (image) => processImage(image), {
            concurrency: CONCURRENCY,
        })

        if (fix) {
            await db.knexReadWriteTransaction(async (trx) => {
                for (const result of results) {
                    if (result.text !== null) {
                        await trx("images")
                            .where({ id: result.image.id })
                            .update({ extractedText: result.text })
                    }
                }
            }, TransactionCloseMode.Close)
        }

        for (const result of results) {
            logResult(result, fix)
        }

        for (const result of results) {
            if (result.cost === null) unpricedImages++
            else totalCost += result.cost
        }

        console.log(
            `\n  Batch ${b + 1} done. Running total cost: ${formatTotal(totalCost, unpricedImages)}`
        )

        if (b < totalBatches - 1) {
            console.log(
                `  Pausing ${PAUSE_BETWEEN_BATCHES_MS / 1000}s before next batch... (Ctrl+C to stop)`
            )
            await sleep(PAUSE_BETWEEN_BATCHES_MS)
        }
    }

    console.log(`\n=== Final Summary ===`)
    console.log(`  Images processed: ${images.length}`)
    console.log(
        `  Total estimated cost: ${formatTotal(totalCost, unpricedImages)}`
    )
}

function formatTotal(totalCost: number, unpricedImages: number): string {
    const total = `$${totalCost.toFixed(4)}`
    return unpricedImages > 0
        ? `${total} (excludes ${unpricedImages} image(s) with no price)`
        : total
}

void main().then(() => process.exit())
