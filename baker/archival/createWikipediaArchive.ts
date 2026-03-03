/**
 * Creates a Wikipedia-specific copy of the main archive by stripping Google
 * Tag Manager scripts from data pages (grapher/explorer HTML) while
 * hard-linking all other assets unchanged. Post pages (paired .html +
 * .manifest.json not under grapher/ or explorers/) and the top-level
 * images/ and videos/ directories are skipped entirely.
 *
 * Local:      make wikipedia-archive (also runs `make archive` first)
 * Production: ops/templates/owid-cloudflare-prod/deploy-wikipedia-archive.sh
 */
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import fs from "fs/promises"
import path from "path"
import pMap from "p-map"
import { GTM_MARKER_BEGIN, GTM_MARKER_END } from "../../site/Head.js"

interface Options {
    inputDir: string
    outputDir: string
    dryRun?: boolean
}

interface Stats {
    htmlProcessed: number
    hardLinked: number
    skipped: number
}

/**
 * Regex that matches from the GTM begin marker script tag through the GTM end
 * marker script tag, inclusive of both tags and everything in between.
 */
export function buildGtmStripRegex(): RegExp {
    const begin = GTM_MARKER_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const end = GTM_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(
        `<script\\s+data-owid-marker="${begin}"\\s*>\\s*</script>[\\s\\S]*?<script\\s+data-owid-marker="${end}"\\s*>\\s*</script>`,
        "g"
    )
}

/**
 * Returns true if the relative path represents an HTML file under a
 * grapher/ or explorers/ subdirectory (i.e. a data page, not a post).
 *
 * See README.md "Archived pages" for the archive directory layout:
 *   /DATE-TIME/grapher/SLUG.html
 *   /DATE-TIME/explorers/SLUG.html
 *   /latest/grapher/SLUG.html
 *   /latest/explorers/SLUG.html
 */
export function isDataPageHtml(relativePath: string): boolean {
    const parts = relativePath.split(path.sep)
    // Must have at least 3 parts: dateDir/grapher|explorers/file.html
    if (parts.length < 3) return false
    // Must be an HTML file
    if (!relativePath.endsWith(".html")) return false
    // The second segment (index 1) should be "grapher" or "explorers"
    return parts[1] === "grapher" || parts[1] === "explorers"
}

/**
 * Identifies post files to skip. A post is defined as a paired SLUG.html and
 * SLUG.manifest.json that are NOT under grapher/ or explorers/. Only when
 * both files in a pair exist are they considered post files.
 *
 *   /DATE-TIME/SLUG.html + /DATE-TIME/SLUG.manifest.json
 *   /latest/SLUG.html + /latest/SLUG.manifest.json
 */
export function findPostFiles(allFiles: string[]): Set<string> {
    const postFiles = new Set<string>()

    const allFilesSet = new Set(allFiles)
    const postHtmlCandidates = allFiles.filter(
        (filePath) => filePath.endsWith(".html") && !isDataPageHtml(filePath)
    )

    for (const htmlPath of postHtmlCandidates) {
        const manifestPath = htmlPath.replace(/\.html$/, ".manifest.json")
        if (allFilesSet.has(manifestPath)) {
            postFiles.add(htmlPath)
            postFiles.add(manifestPath)
        }
    }

    return postFiles
}

/**
 * Top-level directories to skip entirely in the Wikipedia archive.
 * These contain images and videos that are used by articles (which we
 * don't archive for Wikipedia).
 */
const SKIP_DIRS = new Set(["images", "videos"])

/**
 * Recursively collects all file paths relative to `dir`,
 * skipping directories listed in SKIP_DIRS at the top level.
 */
async function walkDir(
    dir: string,
    base: string = "",
    results: string[] = []
): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const isTopLevel = base === ""

    for (const entry of entries) {
        const rel = base ? path.join(base, entry.name) : entry.name
        if (entry.isDirectory()) {
            if (isTopLevel && SKIP_DIRS.has(entry.name)) continue
            await walkDir(path.join(dir, entry.name), rel, results)
        } else if (entry.isFile()) {
            results.push(rel)
        }
    }

    return results
}

/**
 * Ensure the parent directory for `filePath` exists.
 */
async function ensureParentDir(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
}

async function createWikipediaArchive(opts: Options): Promise<void> {
    const { inputDir, outputDir, dryRun } = opts
    const gtmRegex = buildGtmStripRegex()
    const stats: Stats = { htmlProcessed: 0, hardLinked: 0, skipped: 0 }

    console.log(`Input directory: ${inputDir}`)
    console.log(`Output directory: ${outputDir}`)
    if (dryRun) {
        console.log("Dry run mode — no files will be written.")
    }

    // Walk the entire input tree
    const allFiles = await walkDir(inputDir)

    // Build the set of post files to skip. A post is a paired SLUG.html and
    // SLUG.manifest.json not under grapher/ or explorers/. When both files in
    // a pair exist, we skip them.
    const postFilesToSkip = findPostFiles(allFiles)

    const filesToProcess: Array<{
        relativePath: string
        action: "strip-gtm" | "hardlink" | "skip"
    }> = []

    for (const relativePath of allFiles) {
        if (isDataPageHtml(relativePath)) {
            filesToProcess.push({ relativePath, action: "strip-gtm" })
        } else if (postFilesToSkip.has(relativePath)) {
            filesToProcess.push({ relativePath, action: "skip" })
        } else {
            filesToProcess.push({ relativePath, action: "hardlink" })
        }
    }

    if (dryRun) {
        const stripCount = filesToProcess.filter(
            (f) => f.action === "strip-gtm"
        ).length
        const linkCount = filesToProcess.filter(
            (f) => f.action === "hardlink"
        ).length
        const skipCount = filesToProcess.filter(
            (f) => f.action === "skip"
        ).length
        console.log(
            `Would process ${stripCount} HTML data pages, hard-link ${linkCount} files, skip ${skipCount} post files.`
        )
        return
    }

    // Create the output directory
    await fs.mkdir(outputDir, { recursive: true })

    // Process all files with up to 50 concurrent operations
    await pMap(
        filesToProcess,
        async (file) => {
            const srcPath = path.join(inputDir, file.relativePath)
            const destPath = path.join(outputDir, file.relativePath)

            switch (file.action) {
                case "skip":
                    stats.skipped++
                    return

                case "strip-gtm": {
                    await ensureParentDir(destPath)
                    const html = await fs.readFile(srcPath, "utf-8")
                    const stripped = html.replace(gtmRegex, "")
                    await fs.writeFile(destPath, stripped, "utf-8")
                    stats.htmlProcessed++
                    return
                }

                case "hardlink": {
                    await ensureParentDir(destPath)
                    // Remove existing file if present (hard link will fail otherwise)
                    await fs.unlink(destPath).catch(() => {
                        // ignore if it doesn't exist
                    })
                    await fs.link(srcPath, destPath)
                    stats.hardLinked++
                    return
                }
            }
        },
        { concurrency: 50 }
    )

    console.log(
        `\nProcessing complete: ${stats.htmlProcessed} HTML files processed, ${stats.hardLinked} files hard-linked, ${stats.skipped} files skipped.`
    )
}

if (require.main === module) {
    void yargs(hideBin(process.argv))
        .command<Options>(
            "$0",
            "Create a Wikipedia-specific archive with GTM scripts removed from data pages",
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
                            "Path to the output Wikipedia archive directory",
                    })
                    .option("dryRun", {
                        type: "boolean",
                        describe:
                            "Report what would happen without writing any files",
                    })
            },
            async (opts) => {
                await createWikipediaArchive(opts).catch((e) => {
                    console.error("Error creating Wikipedia archive:", e)
                    process.exit(1)
                })
            }
        )
        .help()
        .alias("help", "h")
        .strict().argv
}
