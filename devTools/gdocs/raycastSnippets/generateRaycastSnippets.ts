import path from "node:path"
import { readFile, writeFile } from "node:fs/promises"
import { enrichedBlockExamples } from "../../../db/model/Gdoc/exampleEnrichedBlocks.js"
import { enrichedBlockToRawBlock } from "../../../db/model/Gdoc/enrichedToRaw.js"
import { OwidRawGdocBlockToArchieMLString } from "../../../db/model/Gdoc/rawToArchie.js"
import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
    RawBlockTableRow,
} from "@ourworldindata/types"

type RaycastSnippet = {
    name: string
    text: string
    keyword: string
}

const repoRoot = path.resolve(__dirname, "../../..")

const SNIPPETS_PATH = path.join(
    repoRoot,
    "packages",
    "@ourworldindata",
    "types",
    "src",
    "gdocTypes",
    "raycastSnippets.json"
)

// Some components have no body or are otherwise not useful as snippets,
// we can skip them and not throw an error if they're missing from the snippets file.
const EXEMPT_BLOCK_TYPES = [
    "text",
    "simple-text",
    "donors",
    "homepage-intro",
    "homepage-search",
    "latest-data-insights",
    "people",
    "people-rows",
    "person",
    "pill-row",
    "sdg-grid",
    "socials",
]

async function readSnippetsFile(): Promise<RaycastSnippet[]> {
    try {
        const fileContents = await readFile(SNIPPETS_PATH, "utf8")
        const snippets = JSON.parse(fileContents) as RaycastSnippet[]
        if (!Array.isArray(snippets))
            throw new Error("Snippets file is not an array")
        return snippets
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
        throw error
    }
}

const PRESERVE_STRING_KEYS = new Set(["type", "spanType"])

const blankStringValue = (value: string, key?: string) =>
    PRESERVE_STRING_KEYS.has(key ?? "") ? value : ""

const sanitizeValue = (value: unknown, key?: string): unknown => {
    if (typeof value === "string") return blankStringValue(value, key)
    if (value === null || value === undefined) return value
    if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry))
    if (typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([entryKey, entryValue]) => [
                entryKey,
                sanitizeValue(entryValue, entryKey),
            ])
        )
    }
    return value
}

const sanitizeBlock = (
    block: OwidRawGdocBlock | RawBlockTableRow
): typeof block => sanitizeValue(block) as typeof block

function blockToSnippet(block: OwidEnrichedGdocBlock): RaycastSnippet {
    const rawBlock = sanitizeBlock(enrichedBlockToRawBlock(block))
    const text = OwidRawGdocBlockToArchieMLString(rawBlock).trim()
    return {
        name: block.type,
        text,
        keyword: `+${block.type}`,
    }
}

const getAllExampleBlocks = () => Object.values(enrichedBlockExamples)

async function writeSnippetsFile(snippets: RaycastSnippet[]) {
    const serialized = JSON.stringify(snippets, null, 4) + "\n"
    await writeFile(SNIPPETS_PATH, serialized)
}

/**
 * Generates Raycast snippets for all ArchieML components defined in enrichedBlockExamples.
 * If run with the --check flag, it will only check for missing snippets without modifying the file.
 *
 * Once these are imported into Raycast (via the "Import Snippets" command), they can be used
 * by typing the associated keyword (e.g., +chart) in any text input.
 */
async function main() {
    const args = new Set(process.argv.slice(2))
    const checkMode = args.has("--check")
    const snippets = await readSnippetsFile()
    const snippetsByName = new Map(
        snippets.map((snippet) => [snippet.name, snippet])
    )

    const missing = getAllExampleBlocks()
        .filter((block) => !snippetsByName.has(block.type))
        .filter((block) => !EXEMPT_BLOCK_TYPES.includes(block.type))
        .map(blockToSnippet)
        .sort((a, b) => a.name.localeCompare(b.name))

    if (checkMode) {
        if (missing.length) {
            console.error(
                `Missing ${missing.length} ArchieML snippet(s): ${missing
                    .map((snippet) => snippet.name)
                    .join(", ")}`
            )
            console.error("Run 'yarn generateRaycastSnippets' to add them.")
            process.exitCode = 1
            return
        }
        console.log("All ArchieML components already have snippets.")
        return
    }

    if (missing.length === 0) {
        console.log("No new ArchieML snippets to append.")
        return
    }

    const updatedSnippets = [...snippets, ...missing]
    await writeSnippetsFile(updatedSnippets)
    console.log(
        `Appended ${missing.length} ArchieML snippet(s): ${missing
            .map((snippet) => snippet.name)
            .join(", ")}`
    )
}

main().catch((error) => {
    console.error("Error generating Raycast snippets:", error)
    process.exit(1)
})
