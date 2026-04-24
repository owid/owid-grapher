/**
 * Backfill script to extract text from images using GPT vision.
 *
 * Usage:
 *   # Test with a single image (dry-run)
 *   yarn tsx devTools/extractImageText.ts --id 123
 *
 *   # Backfill all images missing extractedText
 *   yarn tsx devTools/extractImageText.ts --all --fix
 */

import pMap from "p-map"
import * as db from "../db/db.js"
import { TransactionCloseMode } from "../db/db.js"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings.js"
import { DbEnrichedImage } from "@ourworldindata/types"
import {
    fetchGptGeneratedTextFromImage,
    TextExtractionResult,
} from "../adminSiteServer/imagesHelpers.js"

// Pricing per 1M tokens for gpt-5-mini (as of March 2026)
const PRICING = { input: 0.25, output: 2 }

function estimateCost(usage: TextExtractionResult["usage"]): string {
    if (!usage) return "unknown (no usage data)"

    const inputCost = (usage.promptTokens / 1_000_000) * PRICING.input
    const outputCost = (usage.completionTokens / 1_000_000) * PRICING.output
    const totalCost = inputCost + outputCost

    return `$${totalCost.toFixed(6)} (${usage.promptTokens} prompt + ${usage.completionTokens} completion tokens)`
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
    cost: number
}

async function processImage(image: DbEnrichedImage): Promise<ImageResult> {
    const url = `${CLOUDFLARE_IMAGES_URL}/${image.cloudflareId}/public`
    const { text, usage } = await fetchGptGeneratedTextFromImage(url)

    let cost = 0
    if (usage) {
        cost =
            (usage.promptTokens / 1_000_000) * PRICING.input +
            (usage.completionTokens / 1_000_000) * PRICING.output
    }

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

        totalCost += results.reduce((sum, r) => sum + r.cost, 0)

        console.log(
            `\n  Batch ${b + 1} done. Running total cost: $${totalCost.toFixed(4)}`
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
    console.log(`  Total estimated cost: $${totalCost.toFixed(4)}`)
}

void main().then(() => process.exit())
