#!/usr/bin/env node
/*
 * Generate the OWID Archie components reference from sibling .md sidecars.
 *
 * Run:
 *     yarn generateComponentsReference
 *
 * Outputs:
 *     docs/components-reference.generated.md
 *     docs/components.registry.generated.json
 *
 * Exits non-zero on: missing sidecar, missing "type:" discriminator, archie
 * example that fails to parse via archieToEnriched. CI also fails the build
 * if regenerating produces a diff against the committed artifacts (see the
 * "components-reference" job in .github/workflows/ci.yml).
 *
 * Pipeline:
 *   1. Parse OwidEnrichedGdocBlock (in ArchieMlComponents.ts) via tsgo AST to
 *      get the canonical, ordered list of EnrichedBlock* identifiers.
 *   2. Index every TypeAliasDeclaration in archieMLComponents/ so we can look
 *      up each union member.
 *   3. For each union member: read its sibling .md sidecar (named after the
 *      alias minus the EnrichedBlock prefix), parse front-matter + harvest
 *      every fenced archie block, and derive the id from the alias body's
 *      "type" property literal.
 *   4. Validate every archie example through archieToEnriched.
 *   5. Render docs/components-reference.generated.md and
 *      docs/components.registry.generated.json.
 *
 * Completeness is structural: every union member becomes a doc entry by
 * iteration, and missing/malformed sidecars fail the build.
 *
 * Uses @typescript/native-preview (tsgo) for AST work — the same compiler
 * the rest of the repo uses for yarn typecheck.
 */

import fs from "fs-extra"
import path from "path"

import { API } from "@typescript/native-preview/sync"
import type {
    Identifier,
    Node,
    SourceFile,
    TypeAliasDeclaration,
    TypeNode,
} from "@typescript/native-preview/ast"
import {
    isIdentifier,
    isIntersectionTypeNode,
    isLiteralTypeNode,
    isPropertySignatureDeclaration,
    isStringLiteral,
    isTypeAliasDeclaration,
    isTypeLiteralNode,
    isTypeReferenceNode,
    isUnionTypeNode,
} from "@typescript/native-preview/ast/is"

import { archieToEnriched } from "../../db/model/Gdoc/archieToEnriched.js"

const BT = String.fromCharCode(96)
const FENCE = BT + BT + BT

const REPO_ROOT = path.resolve(__dirname, "../..")
const COMPONENTS_DIR = path.resolve(
    REPO_ROOT,
    "packages/@ourworldindata/types/src/gdocTypes/archieMLComponents"
)
const ARCHIE_ML_COMPONENTS_TS = path.resolve(
    REPO_ROOT,
    "packages/@ourworldindata/types/src/gdocTypes/ArchieMlComponents.ts"
)
const TSCONFIG_PATH = path.resolve(
    REPO_ROOT,
    "packages/@ourworldindata/types/tsconfig.json"
)
const DOCS_DIR = path.resolve(REPO_ROOT, "docs")
const MD_OUT = path.join(DOCS_DIR, "components-reference.generated.md")
const JSON_OUT = path.join(DOCS_DIR, "components.registry.generated.json")
const UNION_NAME = "OwidEnrichedGdocBlock"

type ComponentExample = {
    name: string
    archie: string
}

type ComponentDoc = {
    id: string
    title: string
    sourceFile: string
    sidecarFile: string
    typeName: string
    body: string
    examples: ComponentExample[]
}

function findUnionDecl(sf: SourceFile): TypeAliasDeclaration {
    let found: TypeAliasDeclaration | undefined
    sf.forEachChild((node: Node) => {
        if (isTypeAliasDeclaration(node) && node.name.text === UNION_NAME) {
            found = node
        }
        return undefined
    })
    if (!found)
        throw new Error(
            "Could not find type alias " +
                UNION_NAME +
                " in " +
                ARCHIE_ML_COMPONENTS_TS
        )
    return found
}

function unionMemberIdentifiers(unionDecl: TypeAliasDeclaration): Identifier[] {
    const unionNode = unionDecl.type
    if (!isUnionTypeNode(unionNode))
        throw new Error(UNION_NAME + " is not a union type")
    const ids: Identifier[] = []
    for (const member of unionNode.types) {
        if (!isTypeReferenceNode(member))
            throw new Error(UNION_NAME + " member is not a type reference")
        const typeName = member.typeName
        if (!isIdentifier(typeName))
            throw new Error(
                UNION_NAME + " member typeName is not a simple identifier"
            )
        ids.push(typeName)
    }
    return ids
}

function buildAliasIndex(
    program: { getSourceFile(file: string): SourceFile | undefined },
    sourceFiles: readonly { fileName: string }[]
): Map<string, TypeAliasDeclaration> {
    const index = new Map<string, TypeAliasDeclaration>()
    for (const { fileName } of sourceFiles) {
        if (!fileName.startsWith(COMPONENTS_DIR + path.sep)) continue
        if (!fileName.endsWith(".ts") || fileName.endsWith(".test.ts")) continue
        const sf = program.getSourceFile(fileName)
        if (!sf) continue
        sf.forEachChild((node: Node) => {
            if (isTypeAliasDeclaration(node)) {
                index.set(node.name.text, node)
            }
            return undefined
        })
    }
    return index
}

function findTypeDiscriminator(typeNode: TypeNode): string | undefined {
    if (isIntersectionTypeNode(typeNode)) {
        for (const member of typeNode.types) {
            const id = findTypeDiscriminator(member)
            if (id !== undefined) return id
        }
        return undefined
    }
    if (!isTypeLiteralNode(typeNode)) return undefined
    for (const member of typeNode.members) {
        if (!isPropertySignatureDeclaration(member)) continue
        const name = member.name
        if (!isIdentifier(name) || name.text !== "type") continue
        const valueType = member.type
        if (!isLiteralTypeNode(valueType)) continue
        const literal = valueType.literal
        if (!isStringLiteral(literal)) continue
        return literal.text
    }
    return undefined
}

function deriveTitle(aliasName: string): string {
    const stripped = aliasName.replace(/^(Enriched|Raw)Block/, "")
    return stripped
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
}

function parseSidecar(text: string): {
    title?: string
    body: string
    examples: ComponentExample[]
} {
    let rest = text
    let title: string | undefined
    const fmMatch = /^---\r?\n([\s\S]+?)\r?\n---\r?\n/.exec(rest)
    if (fmMatch) {
        const titleMatch = /^title:\s*(.+)$/m.exec(fmMatch[1])
        if (titleMatch) title = titleMatch[1].trim()
        rest = rest.slice(fmMatch[0].length)
    }
    rest = rest.trim()

    const examples: ComponentExample[] = []
    const fenceRe = new RegExp(
        FENCE + "archie\\r?\\n([\\s\\S]+?)\\r?\\n" + FENCE,
        "g"
    )
    let m: RegExpExecArray | null
    let n = 0
    while ((m = fenceRe.exec(rest)) !== null) {
        n++
        const before = rest.slice(0, m.index)
        let name = "Example " + n
        const lines = before.split(/\r?\n/).reverse()
        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith(FENCE)) continue
            name = trimmed.replace(/^#+\s*/, "").replace(/[:.\s]+$/, "")
            break
        }
        examples.push({ name, archie: m[1] })
    }
    return { title, body: rest, examples }
}

function validateExamples(docs: ComponentDoc[]): {
    ok: boolean
    failures: string[]
} {
    const failures: string[] = []
    for (const doc of docs) {
        for (const ex of doc.examples) {
            const wrapped =
                "title: " +
                doc.title +
                " example\ntype: fragment\n[+body]\n" +
                ex.archie +
                "\n[]\n"
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
                        doc.id +
                            ' / "' +
                            ex.name +
                            '":\n    ' +
                            parseErrors.join("\n    ")
                    )
                }
            } catch (err) {
                failures.push(
                    doc.id +
                        ' / "' +
                        ex.name +
                        '": threw ' +
                        (err as Error).message
                )
            }
        }
    }
    return { ok: failures.length === 0, failures }
}

function slug(id: string): string {
    return id.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

function renderMarkdown(docs: ComponentDoc[]): string {
    const lines: string[] = []
    lines.push("<!-- GENERATED FILE — DO NOT EDIT -->")
    lines.push(
        "<!-- Source: sibling .md sidecars in packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ -->"
    )
    lines.push("<!-- Regenerate: yarn generateComponentsReference -->\n")
    lines.push("# OWID Archie Components Reference\n")
    lines.push(
        "Generated reference for every component authors can use in Gdocs / content-repo files. "
    )
    lines.push(
        "Every example in this doc is parsed through archieToEnriched at generation time; CI fails on drift.\n"
    )
    lines.push("## Components\n")
    for (const doc of docs) {
        lines.push(
            "- [" + doc.title + "](#" + slug(doc.id) + ") — `{." + doc.id + "}`"
        )
    }
    lines.push("")
    for (const doc of docs) {
        lines.push("\n## " + doc.title + "\n")
        lines.push(
            "`{." +
                doc.id +
                "}` — defined in `" +
                doc.sourceFile +
                "`, documented in `" +
                doc.sidecarFile +
                "`\n"
        )
        lines.push(doc.body + "\n")
    }
    return lines.join("\n")
}

function extractComponentDocs(api: InstanceType<typeof API>): ComponentDoc[] {
    const snapshot = api.updateSnapshot({ openProject: TSCONFIG_PATH })
    const project = snapshot.getProject(TSCONFIG_PATH)
    if (!project)
        throw new Error("tsgo could not load project at " + TSCONFIG_PATH)
    const program = project.program

    const sf = program.getSourceFile(ARCHIE_ML_COMPONENTS_TS)
    if (!sf)
        throw new Error(
            "Source file not loaded by tsgo: " + ARCHIE_ML_COMPONENTS_TS
        )

    const aliasIndex = buildAliasIndex(
        program,
        project.rootFiles.map((fileName) => ({ fileName }))
    )

    const unionDecl = findUnionDecl(sf)
    const memberIds = unionMemberIdentifiers(unionDecl)
    if (memberIds.length === 0) throw new Error(UNION_NAME + " has no members")

    const docs: ComponentDoc[] = []
    const seenIds = new Set<string>()
    for (const ident of memberIds) {
        const typeName = ident.text
        const decl = aliasIndex.get(typeName)
        if (!decl)
            throw new Error(
                "Could not find TypeAliasDeclaration for " +
                    typeName +
                    " in archieMLComponents/"
            )
        const sourceFile = path.relative(
            REPO_ROOT,
            decl.getSourceFile().fileName
        )

        const id = findTypeDiscriminator(decl.type)
        if (id === undefined)
            throw new Error(
                typeName +
                    ' has no string-literal "type" discriminator in ' +
                    sourceFile
            )
        if (seenIds.has(id))
            throw new Error('Duplicate component id "' + id + '"')
        seenIds.add(id)

        const sidecarName = typeName.replace(/^EnrichedBlock/, "")
        const sidecarPath = path.join(COMPONENTS_DIR, sidecarName + ".md")
        if (!fs.existsSync(sidecarPath))
            throw new Error(
                typeName +
                    " (" +
                    id +
                    ") has no sidecar at " +
                    path.relative(REPO_ROOT, sidecarPath)
            )
        const sidecarText = fs.readFileSync(sidecarPath, "utf-8")
        const {
            title: titleOverride,
            body,
            examples,
        } = parseSidecar(sidecarText)
        if (!body)
            throw new Error(
                typeName +
                    " sidecar is empty: " +
                    path.relative(REPO_ROOT, sidecarPath)
            )

        const title = titleOverride ?? deriveTitle(typeName)
        docs.push({
            id,
            title,
            typeName,
            sourceFile,
            sidecarFile: path.relative(REPO_ROOT, sidecarPath),
            body,
            examples,
        })
    }
    return docs
}

async function main(): Promise<void> {
    const api = new API({ cwd: REPO_ROOT })
    try {
        const allDocs = extractComponentDocs(api)
        allDocs.sort((a, b) => a.title.localeCompare(b.title))

        console.log(
            "Extracted " +
                allDocs.length +
                " component(s) from " +
                UNION_NAME +
                "."
        )

        const { ok, failures } = validateExamples(allDocs)
        if (!ok) {
            console.error(
                "\n" +
                    failures.length +
                    " example(s) failed to parse cleanly:\n"
            )
            for (const f of failures) console.error("  - " + f)
            process.exitCode = 1
            return
        }
        console.log("All examples parsed cleanly.")

        await fs.ensureDir(DOCS_DIR)
        await fs.writeFile(MD_OUT, renderMarkdown(allDocs))
        await fs.writeFile(JSON_OUT, JSON.stringify(allDocs, null, 2))
        console.log("Wrote " + path.relative(process.cwd(), MD_OUT))
        console.log("Wrote " + path.relative(process.cwd(), JSON_OUT))
    } finally {
        api.close()
    }
}

void main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
