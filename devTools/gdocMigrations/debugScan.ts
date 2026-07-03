import { ThrottledDocsClient } from "./engine/throttledDocsClient.js"
import { gdocToSourceMappedLines } from "./engine/sourceMap.js"
import { scanScopes } from "./engine/scopeScanner.js"

/**
 * Diagnostic: runs the engine's scope scanner over a live doc and prints any
 * imbalances with surrounding context. Useful for understanding why a doc
 * was flagged "unbalanced-scopes".
 *
 *   yarn tsx --tsconfig tsconfig.tsx.json devTools/gdocMigrations/debugScan.ts <docId>
 */
async function main(): Promise<void> {
    const docId = process.argv[2]
    if (!docId) throw new Error("usage: debugScan.ts <docId>")
    const client = new ThrottledDocsClient()
    const document = await client.getDocument(docId)
    const lines = gdocToSourceMappedLines(document)
    const scan = scanScopes(lines)

    if (scan.imbalances.length === 0) {
        console.log(
            `no imbalances — ${scan.blocks.length} block(s), ${scan.frontmatter.length} frontmatter key(s)`
        )
        return
    }
    for (const imbalance of scan.imbalances) {
        console.log(`\n${imbalance.detail}`)
        // print nearby context plus any structural-looking lines above, so
        // the unmatched opening tag is visible
        const from = Math.max(0, imbalance.lineIndex - 40)
        for (
            let i = from;
            i <= Math.min(lines.length - 1, imbalance.lineIndex + 2);
            i++
        ) {
            const text = lines[i].text
            const nearby = Math.abs(i - imbalance.lineIndex) <= 3
            const structural = /[{}[\]]/.test(text)
            if (!nearby && !structural) continue
            const marker = i === imbalance.lineIndex ? ">>" : "  "
            console.log(
                `  ${marker} ${String(i).padStart(4)} | ${JSON.stringify(text.slice(0, 140))}`
            )
        }
    }
}

void main()
