#!/usr/bin/env node
/**
 * Extract JSDoc-based component documentation from archieMLComponents/*.ts
 * and emit two artifacts:
 *
 *   1. docs/components-reference.generated.md — human-readable, single-source
 *      author reference (replacing the hand-maintained "Writing OWID Articles"
 *      Google Doc over time).
 *   2. docs/components.registry.generated.json — machine-readable bundle for
 *      agent consumption (Claude Code skills, admin UI component picker).
 *
 * Every `@example` block in the extracted JSDoc is parsed through
 * archieToEnriched. If any example produces parseErrors the script exits
 * non-zero, so CI will catch doc drift.
 *
 * Output lives in the CODE repo (docs/), never in the content repo — these are
 * tooling artifacts, not publishable content.
 */

import fs from "fs-extra"
import path from "path"
import ts from "typescript"

import { archieToEnriched } from "../../db/model/Gdoc/archieToEnriched.js"

const COMPONENTS_DIR = path.resolve(
    __dirname,
    "../../packages/@ourworldindata/types/src/gdocTypes/archieMLComponents"
)
const DOCS_DIR = path.resolve(__dirname, "../../docs")
const MD_OUT = path.join(DOCS_DIR, "components-reference.generated.md")
const JSON_OUT = path.join(DOCS_DIR, "components.registry.generated.json")

type ComponentExample = {
    name: string
    archie: string
}

type ComponentDoc = {
    id: string
    title: string
    sourceFile: string
    typeName: string
    body: string // JSDoc body with @owid-* and @example tags stripped
    examples: ComponentExample[]
}

function extractComponentDocsFromFile(filePath: string): ComponentDoc[] {
    const text = fs.readFileSync(filePath, "utf-8")
    const sourceFile = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.Latest,
        true
    )

    const docs: ComponentDoc[] = []
    ts.forEachChild(sourceFile, (node) => {
        if (!ts.isTypeAliasDeclaration(node)) return
        const typeName = node.name.text
        const jsDocNodes = ts.getJSDocCommentsAndTags(node)
        for (const jsDoc of jsDocNodes) {
            if (!ts.isJSDoc(jsDoc)) continue
            const raw =
                typeof jsDoc.comment === "string"
                    ? jsDoc.comment
                    : (jsDoc.comment
                          ?.map((p) => (ts.isJSDocText(p) ? p.text : ""))
                          .join("") ?? "")
            const tags = (jsDoc.tags ?? []) as readonly ts.JSDocTag[]

            const componentId = getTagText(tags, "owid-component")
            if (!componentId) continue

            const title = getTagText(tags, "owid-title") ?? componentId
            const examples: ComponentExample[] = []
            for (const tag of tags) {
                if (tag.tagName.text !== "example") continue
                const { name, archie } = parseExampleTag(tag)
                if (archie) examples.push({ name, archie })
            }

            docs.push({
                id: componentId,
                title,
                typeName,
                sourceFile: path.relative(
                    path.resolve(__dirname, "../.."),
                    filePath
                ),
                body: raw.trim(),
                examples,
            })
        }
    })
    return docs
}

function getTagText(
    tags: readonly ts.JSDocTag[],
    name: string
): string | undefined {
    const tag = tags.find((t) => t.tagName.text === name)
    if (!tag || typeof tag.comment !== "string") return undefined
    return tag.comment.trim()
}

function parseExampleTag(tag: ts.JSDocTag): {
    name: string
    archie: string | null
} {
    const text =
        typeof tag.comment === "string"
            ? tag.comment
            : (tag.comment
                  ?.map((p) => (ts.isJSDocText(p) ? p.text : ""))
                  .join("") ?? "")
    // "Name\n```archie\n<code>\n```"
    const match = text.match(/^(.*?)\r?\n```archie\r?\n([\s\S]*?)\r?\n```/)
    if (!match) return { name: text.trim() || "Example", archie: null }
    return {
        name: (match[1] || "Example").trim(),
        archie: match[2],
    }
}

function validateExamples(docs: ComponentDoc[]): {
    ok: boolean
    failures: string[]
} {
    const failures: string[] = []
    for (const doc of docs) {
        for (const ex of doc.examples) {
            // archieToEnriched expects a full body; wrap the snippet in a
            // minimal [+body] frame so it parses in its normal context.
            const wrapped = `title: ${doc.title} example\ntype: fragment\n[+body]\n${ex.archie}\n[]\n`
            try {
                const enriched = archieToEnriched(wrapped)
                const bodyBlocks = enriched.body ?? []
                const parseErrors: string[] = []
                for (const block of bodyBlocks) {
                    for (const err of block.parseErrors ?? [])
                        parseErrors.push(err.message)
                }
                if (parseErrors.length) {
                    failures.push(
                        `${doc.id} / "${ex.name}":\n    ${parseErrors.join("\n    ")}`
                    )
                }
            } catch (err) {
                failures.push(
                    `${doc.id} / "${ex.name}": threw ${(err as Error).message}`
                )
            }
        }
    }
    return { ok: failures.length === 0, failures }
}

function renderMarkdown(docs: ComponentDoc[]): string {
    const lines: string[] = []
    lines.push("<!-- GENERATED FILE — DO NOT EDIT -->")
    lines.push(
        `<!-- Source: JSDoc in packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/*.ts -->`
    )
    lines.push(
        `<!-- Regenerate: yarn tsx --tsconfig tsconfig.tsx.json devTools/gdocs/generate-components-reference.ts -->\n`
    )
    lines.push("# OWID Archie Components Reference\n")
    lines.push(
        "Generated reference for every component authors can use in Gdocs / content-repo files. "
    )
    lines.push(
        "Every example in this doc is parsed through `archieToEnriched` at generation time; CI fails on drift.\n"
    )
    lines.push("## Components\n")
    for (const doc of docs) {
        lines.push(`- [${doc.title}](#${slug(doc.id)}) — \`{.${doc.id}}\``)
    }
    lines.push("")
    for (const doc of docs) {
        lines.push(`\n## ${doc.title}\n`)
        lines.push(`\`{.${doc.id}}\` — defined in \`${doc.sourceFile}\`\n`)
        lines.push(doc.body + "\n")
        if (doc.examples.length > 0) {
            lines.push("### Examples\n")
            for (const ex of doc.examples) {
                lines.push(`**${ex.name}**\n`)
                lines.push("```archie")
                lines.push(ex.archie)
                lines.push("```\n")
            }
        }
    }
    return lines.join("\n")
}

function slug(id: string): string {
    return id.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

async function main(): Promise<void> {
    const entries = await fs.readdir(COMPONENTS_DIR)
    const tsFiles = entries
        .filter((e) => e.endsWith(".ts") && !e.endsWith(".test.ts"))
        .map((e) => path.join(COMPONENTS_DIR, e))

    let allDocs: ComponentDoc[] = []
    for (const file of tsFiles) {
        allDocs = allDocs.concat(extractComponentDocsFromFile(file))
    }
    allDocs.sort((a, b) => a.title.localeCompare(b.title))

    console.log(
        `Extracted ${allDocs.length} documented component(s) from ${tsFiles.length} file(s).`
    )

    const { ok, failures } = validateExamples(allDocs)
    if (!ok) {
        console.error(
            `\n${failures.length} example(s) failed to parse cleanly:\n`
        )
        for (const f of failures) console.error(`  - ${f}`)
        process.exitCode = 1
        return
    }
    console.log("All examples parsed cleanly.")

    await fs.ensureDir(DOCS_DIR)
    await fs.writeFile(MD_OUT, renderMarkdown(allDocs))
    await fs.writeFile(JSON_OUT, JSON.stringify(allDocs, null, 2))
    console.log(`Wrote ${path.relative(process.cwd(), MD_OUT)}`)
    console.log(`Wrote ${path.relative(process.cwd(), JSON_OUT)}`)
}

void main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
