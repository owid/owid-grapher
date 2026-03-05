import path from "path"
import fs from "fs-extra"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import pMap from "p-map"
import { ARCHIVE_BASE_URL } from "../../settings/clientSettings.js"
import { WIKIPEDIA_ARCHIVE_BASE_URL } from "../../settings/serverSettings.js"

/**
 * Strip all <script> tags whose content references Google Tag Manager.
 * Uses a regex to match each <script> to its nearest </script> (the HTML
 * parsing boundary), then checks the captured content for GTM markers.
 */
export function stripGtmScripts(html: string): string {
    return html.replace(
        /<script\b[^>]*>([\s\S]*?)<\/script>/g,
        (match, content: string) => {
            if (
                content.includes("googletagmanager") ||
                content.includes("Google Tag Manager")
            ) {
                return ""
            }
            return match
        }
    )
}

/**
 * Replace all occurrences of the archive base URL with the Wikipedia archive
 * base URL. Simple string replacement — archive URLs are unique and unambiguous
 * in the HTML (they appear in <link>, JSON context, and citation text).
 */
export function rewriteArchiveUrls(
    html: string,
    archiveBaseUrl: string,
    wikipediaBaseUrl: string
): string {
    return html.replaceAll(archiveBaseUrl, wikipediaBaseUrl)
}

async function processFile(
    inputPath: string,
    outputPath: string,
    archiveBaseUrl: string,
    wikipediaBaseUrl: string,
    dryRun: boolean
): Promise<void> {
    if (inputPath.endsWith(".html")) {
        let html = await fs.readFile(inputPath, "utf-8")
        html = stripGtmScripts(html)
        html = rewriteArchiveUrls(html, archiveBaseUrl, wikipediaBaseUrl)
        if (!dryRun) {
            await fs.ensureDir(path.dirname(outputPath))
            await fs.writeFile(outputPath, html, "utf-8")
        }
    } else {
        // Non-HTML files are identical — hard-link to save disk space
        if (!dryRun) {
            await fs.ensureDir(path.dirname(outputPath))
            // Remove existing file if present (hard-link fails if target exists)
            await fs.remove(outputPath)
            await fs.link(inputPath, outputPath)
        }
    }
}

async function walkDir(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, {
        withFileTypes: true,
        recursive: true,
    })
    return entries
        .filter((e) => e.isFile())
        .map((e) => path.join(e.parentPath, e.name))
}

async function createWikipediaArchive(opts: {
    inputDir: string
    outputDir: string
    dryRun: boolean
}) {
    const inputDir = path.resolve(opts.inputDir)
    const outputDir = path.resolve(opts.outputDir)
    const dryRun = opts.dryRun

    if (!ARCHIVE_BASE_URL) {
        console.error(
            "ARCHIVE_BASE_URL is not set. Make sure .env.archive is loaded (PRIMARY_ENV_FILE=.env.archive)."
        )
        process.exit(1)
    }
    if (!WIKIPEDIA_ARCHIVE_BASE_URL) {
        console.error(
            "WIKIPEDIA_ARCHIVE_BASE_URL is not set. Make sure .env.archive is loaded."
        )
        process.exit(1)
    }

    console.log(`Input:  ${inputDir}`)
    console.log(`Output: ${outputDir}`)
    console.log(`Archive URL:   ${ARCHIVE_BASE_URL}`)
    console.log(`Wikipedia URL: ${WIKIPEDIA_ARCHIVE_BASE_URL}`)
    if (dryRun) console.log("(dry run — no files will be written)")

    const files = await walkDir(inputDir)
    const htmlFiles = files.filter((f) => f.endsWith(".html"))
    const otherFiles = files.filter((f) => !f.endsWith(".html"))

    console.log(
        `Found ${files.length} files (${htmlFiles.length} HTML, ${otherFiles.length} other)`
    )

    let processed = 0
    await pMap(
        files,
        async (file) => {
            const relativePath = path.relative(inputDir, file)
            const outputPath = path.join(outputDir, relativePath)
            await processFile(
                file,
                outputPath,
                ARCHIVE_BASE_URL!,
                WIKIPEDIA_ARCHIVE_BASE_URL!,
                dryRun
            )
            processed++
            if (processed % 1000 === 0) {
                console.log(`  Processed ${processed}/${files.length} files...`)
            }
        },
        { concurrency: 50 }
    )

    console.log(`Done. Processed ${processed} files.`)
}

if (require.main === module) {
    void yargs(hideBin(process.argv))
        .command<{ inputDir: string; outputDir: string; dryRun: boolean }>(
            "$0",
            "Create a Wikipedia-specific archive with GTM scripts removed",
            (yargs) => {
                yargs
                    .option("inputDir", {
                        type: "string",
                        default: "archive/",
                        describe: "Path to the main archive directory",
                    })
                    .option("outputDir", {
                        type: "string",
                        default: "wikipedia-archive/",
                        describe:
                            "Path to the Wikipedia archive output directory",
                    })
                    .option("dryRun", {
                        type: "boolean",
                        default: false,
                        describe: "Process files without writing output",
                    })
            },
            async (opts) => {
                await createWikipediaArchive(opts)
                process.exit(0)
            }
        )
        .help()
        .alias("help", "h")
        .strict().argv
}
