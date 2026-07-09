#!/usr/bin/env node
/*
 * Generate the OWID gdoc references from .md sidecars + the type definitions:
 *   - the ArchieML components reference (one entry per OwidEnrichedGdocBlock)
 *   - the gdoc template reference (one entry per writable OwidGdocType:
 *     front-matter fields from the content interfaces, prose + a full
 *     validated example document from sidecars)
 *
 * Run:
 *     yarn generateGdocsReferences
 *
 * Output:
 *     docs/components.registry.generated.json
 *     docs/templates.registry.generated.json
 *
 * Exits non-zero on: missing sidecar, missing "type:" discriminator, an
 * archie example that fails to parse/validate, or a field description that
 * does not match the content interface. CI regenerates these files and
 * auto-commits any drift back to the branch (see the
 * "regenerate-gdocs-references" job in .github/workflows/format.yml), so
 * authors editing sidecars via the GitHub web editor never run it locally.
 *
 * Components pipeline:
 *   1. Parse OwidEnrichedGdocBlock (in ArchieMlComponents.ts) via tsgo AST to
 *      get the canonical, ordered list of EnrichedBlock* identifiers.
 *   2. Index every TypeAliasDeclaration in archieMLComponents/ so we can look
 *      up each union member.
 *   3. For each union member: read its sibling .md sidecar (named after the
 *      alias minus the EnrichedBlock prefix), parse front-matter + harvest
 *      every fenced archie block, and derive the id from the alias body's
 *      "type" property literal.
 *   4. Validate every archie example through validateArchieMl — the same
 *      gate the write API applies (parse, block errors, fixed point).
 *
 * Templates pipeline:
 *   1. For each type in ARCHIE_WRITABLE_GDOC_TYPES, walk its content
 *      interface (OwidGdocPostContent / OwidGdocDataInsightContent in
 *      Gdoc.ts): field name, declared type text, optionality — each
 *      annotated with its write-back fate from the classification consts.
 *   2. Join per-field descriptions from templates/<InterfaceName>.md; every
 *      non-derived field must be described, and every described field must
 *      exist on the interface.
 *   3. Read prose + full-document examples from templates/<PascalType>.md
 *      and validate each example through validateArchieMl — the same gate
 *      the write API applies, front-matter check included.
 *
 * Completeness is structural: every union member / writable type becomes an
 * entry by iteration, and missing/malformed sidecars fail the build.
 *
 * Uses @typescript/native-preview (tsgo) for AST work — the same compiler
 * the rest of the repo uses for yarn typecheck.
 */

import fs from "fs-extra"
import path from "path"

import { API } from "@typescript/native-preview/sync"
import type {
    Identifier,
    InterfaceDeclaration,
    Node,
    PropertyName,
    SourceFile,
    TypeAliasDeclaration,
    TypeNode,
} from "@typescript/native-preview/ast"
import {
    isComputedPropertyName,
    isIdentifier,
    isInterfaceDeclaration,
    isIntersectionTypeNode,
    isLiteralTypeNode,
    isPropertySignatureDeclaration,
    isStringLiteral,
    isTypeAliasDeclaration,
    isTypeLiteralNode,
    isTypeReferenceNode,
    isUnionTypeNode,
} from "@typescript/native-preview/ast/is"

import {
    ARCHIE_WRITABLE_GDOC_TYPES,
    validateArchieMl,
} from "../../db/model/Gdoc/validateArchieMl.js"
import {
    getContentKeysForGdocType,
    OWID_GDOC_ADMIN_MANAGED_KEYS,
    OWID_GDOC_POST_CONTENT_KEYS,
    type OwidGdocType,
    type ComponentDoc,
    type ComponentExample,
    type GdocContentKeyFate,
    type TemplateDoc,
    type TemplateFieldDoc,
} from "@ourworldindata/types"

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
const GDOC_TS = path.resolve(
    REPO_ROOT,
    "packages/@ourworldindata/types/src/gdocTypes/Gdoc.ts"
)
const TEMPLATES_DIR = path.resolve(
    REPO_ROOT,
    "packages/@ourworldindata/types/src/gdocTypes/templates"
)
const DOCS_DIR = path.resolve(REPO_ROOT, "docs")
const JSON_OUT = path.join(DOCS_DIR, "components.registry.generated.json")
const TEMPLATES_JSON_OUT = path.join(
    DOCS_DIR,
    "templates.registry.generated.json"
)
const UNION_NAME = "OwidEnrichedGdocBlock"

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

// Component examples are body fragments; wrap each as a minimal fragment
// document and run it through validateArchieMl — the same gate the write API
// applies (parse, block errors, write-back fixed point) — so a shipped
// example is guaranteed to survive an agent's read-modify-write round trip,
// exactly like the template examples below.
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
            const result = validateArchieMl(wrapped)
            if (!result.valid) {
                failures.push(
                    doc.id +
                        ' / "' +
                        ex.name +
                        '":\n    ' +
                        result.errors
                            .map((e) => e.property + ": " + e.message)
                            .join("\n    ")
                )
                continue
            }
            // The gate can't catch an example that vanishes entirely (an
            // empty document round-trips fine) — e.g. [socials] instead of
            // [.socials] inside [+body] is silently dropped by the parser.
            if ((result.content?.body ?? []).length === 0) {
                failures.push(
                    doc.id +
                        ' / "' +
                        ex.name +
                        '": parsed to zero body blocks — the example is silently dropped by the parser'
                )
            }
        }
    }
    return { ok: failures.length === 0, failures }
}

interface TsProgram {
    getSourceFile(file: string): SourceFile | undefined
}

function openProject(api: InstanceType<typeof API>): {
    program: TsProgram
    rootFiles: readonly string[]
} {
    const snapshot = api.updateSnapshot({ openProject: TSCONFIG_PATH })
    const project = snapshot.getProject(TSCONFIG_PATH)
    if (!project)
        throw new Error("tsgo could not load project at " + TSCONFIG_PATH)
    return { program: project.program, rootFiles: project.rootFiles }
}

function extractComponentDocs(
    program: TsProgram,
    rootFiles: readonly string[]
): ComponentDoc[] {
    const sf = program.getSourceFile(ARCHIE_ML_COMPONENTS_TS)
    if (!sf)
        throw new Error(
            "Source file not loaded by tsgo: " + ARCHIE_ML_COMPONENTS_TS
        )

    const aliasIndex = buildAliasIndex(
        program,
        rootFiles.map((fileName) => ({ fileName }))
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

// ---------------------------------------------------------------------------
// Template reference: front-matter fields + prose per writable gdoc type
// ---------------------------------------------------------------------------

function pascalCaseGdocType(id: string): string {
    return id
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("")
}

function findInterfaceDecl(sf: SourceFile, name: string): InterfaceDeclaration {
    let found: InterfaceDeclaration | undefined
    sf.forEachChild((node: Node) => {
        if (isInterfaceDeclaration(node) && node.name.text === name) {
            found = node
        }
        return undefined
    })
    if (!found)
        throw new Error("Could not find interface " + name + " in " + GDOC_TS)
    return found
}

function propertyNameText(name: PropertyName): string | undefined {
    if (isIdentifier(name)) return name.text
    if (isStringLiteral(name)) return name.text
    if (isComputedPropertyName(name) && isStringLiteral(name.expression))
        return name.expression.text
    return undefined
}

// The declared type as written in the source, with comments stripped and
// whitespace collapsed — e.g. `"heavy" | "light"`.
function declaredTypeText(sf: SourceFile, node: TypeNode): string {
    return sf.text
        .slice(node.pos, node.end)
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\|\s*/, "")
}

// Field descriptions are authored as markdown bullets:
//     - `field-name`: description text,
//       possibly wrapped onto indented continuation lines.
function parseFieldDescriptions(
    text: string,
    sidecarPath: string
): Map<string, string> {
    const descriptions = new Map<string, string>()
    let current: string | undefined
    for (const line of text.split(/\r?\n/)) {
        const entry = /^-\s+`([^`]+)`:\s*(.*)$/.exec(line)
        if (entry) {
            current = entry[1]
            if (descriptions.has(current))
                throw new Error(
                    'Duplicate field description for "' +
                        current +
                        '" in ' +
                        path.relative(REPO_ROOT, sidecarPath)
                )
            descriptions.set(current, entry[2].trim())
        } else if (current && /^\s+\S/.test(line)) {
            descriptions.set(
                current,
                descriptions.get(current) + " " + line.trim()
            )
        } else {
            current = undefined
        }
    }
    return descriptions
}

function extractInterfaceFields(
    sf: SourceFile,
    interfaceName: string,
    keyFates: Record<string, GdocContentKeyFate>
): TemplateFieldDoc[] {
    const decl = findInterfaceDecl(sf, interfaceName)
    const fieldsPath = path.join(TEMPLATES_DIR, interfaceName + ".md")
    const fieldsPathRel = path.relative(REPO_ROOT, fieldsPath)
    if (!fs.existsSync(fieldsPath))
        throw new Error(
            interfaceName + " has no field descriptions at " + fieldsPathRel
        )
    const descriptions = parseFieldDescriptions(
        fs.readFileSync(fieldsPath, "utf-8"),
        fieldsPath
    )

    const fields: TemplateFieldDoc[] = []
    const seen = new Set<string>()
    for (const member of decl.members) {
        if (!isPropertySignatureDeclaration(member))
            throw new Error(interfaceName + " has a non-property member")
        const name = propertyNameText(member.name)
        if (name === undefined)
            throw new Error(
                interfaceName + " has a member with an unsupported name form"
            )
        seen.add(name)
        const writeBack = keyFates[name]
        if (!writeBack)
            throw new Error(
                interfaceName +
                    "." +
                    name +
                    " has no write-back classification (see Gdoc.ts)"
            )
        const description = descriptions.get(name)
        if (!description && writeBack !== "derived")
            throw new Error(
                interfaceName +
                    "." +
                    name +
                    " has no description in " +
                    fieldsPathRel
            )
        fields.push({
            name,
            type: declaredTypeText(sf, member.type),
            optional: member.postfixToken !== undefined,
            writeBack,
            description,
        })
    }
    for (const documented of descriptions.keys()) {
        if (!seen.has(documented))
            throw new Error(
                fieldsPathRel +
                    ' documents "' +
                    documented +
                    '", which is not a field of ' +
                    interfaceName
            )
    }
    return fields
}

function extractTemplateDocs(program: TsProgram): TemplateDoc[] {
    const sf = program.getSourceFile(GDOC_TS)
    if (!sf) throw new Error("Source file not loaded by tsgo: " + GDOC_TS)

    const fieldsByInterface = new Map<string, TemplateFieldDoc[]>()
    const docs: TemplateDoc[] = []
    for (const type of ARCHIE_WRITABLE_GDOC_TYPES) {
        const keyFates = getContentKeysForGdocType(type)
        if (!keyFates)
            throw new Error(
                '"' + type + '" is writable but has no key classification'
            )
        const contentTypeName =
            keyFates === OWID_GDOC_POST_CONTENT_KEYS
                ? "OwidGdocPostContent"
                : "OwidGdocDataInsightContent"
        let fields = fieldsByInterface.get(contentTypeName)
        if (!fields) {
            fields = extractInterfaceFields(sf, contentTypeName, keyFates)
            fieldsByInterface.set(contentTypeName, fields)
        }

        const sidecarName = pascalCaseGdocType(type)
        const sidecarPath = path.join(TEMPLATES_DIR, sidecarName + ".md")
        if (!fs.existsSync(sidecarPath))
            throw new Error(
                'Template type "' +
                    type +
                    '" has no sidecar at ' +
                    path.relative(REPO_ROOT, sidecarPath)
            )
        const {
            title: titleOverride,
            body,
            examples,
        } = parseSidecar(fs.readFileSync(sidecarPath, "utf-8"))
        if (!body)
            throw new Error(
                'Template sidecar for "' +
                    type +
                    '" is empty: ' +
                    path.relative(REPO_ROOT, sidecarPath)
            )
        if (examples.length === 0)
            throw new Error(
                'Template sidecar for "' +
                    type +
                    '" has no full-document archie example'
            )

        docs.push({
            id: type,
            contentTypeName,
            sidecarFile: path.relative(REPO_ROOT, sidecarPath),
            title: titleOverride ?? deriveTitle(sidecarName),
            body,
            fields,
            adminManagedFields: [...OWID_GDOC_ADMIN_MANAGED_KEYS],
            examples,
        })
    }
    return docs
}

// Template examples are full documents, so they go through validateArchieMl —
// the same gate the write API applies (parse, block errors, fixed point,
// front-matter check) — rather than the body-fragment wrapping above.
function validateTemplateExamples(docs: TemplateDoc[]): {
    ok: boolean
    failures: string[]
} {
    const failures: string[] = []
    for (const doc of docs) {
        for (const ex of doc.examples) {
            const result = validateArchieMl(ex.archie)
            if (!result.valid) {
                failures.push(
                    doc.id +
                        ' / "' +
                        ex.name +
                        '":\n    ' +
                        result.errors
                            .map((e) => e.property + ": " + e.message)
                            .join("\n    ")
                )
                continue
            }
            const exampleType = result.content?.type as OwidGdocType | undefined
            if (exampleType !== doc.id)
                failures.push(
                    doc.id +
                        ' / "' +
                        ex.name +
                        '": example has type "' +
                        exampleType +
                        '" but belongs to the "' +
                        doc.id +
                        '" template'
                )
        }
    }
    return { ok: failures.length === 0, failures }
}

async function main(): Promise<void> {
    const api = new API({ cwd: REPO_ROOT })
    try {
        const { program, rootFiles } = openProject(api)

        const allDocs = extractComponentDocs(program, rootFiles)
        allDocs.sort((a, b) => a.title.localeCompare(b.title))
        console.log(
            "Extracted " +
                allDocs.length +
                " component(s) from " +
                UNION_NAME +
                "."
        )

        const templateDocs = extractTemplateDocs(program)
        console.log(
            "Extracted " +
                templateDocs.length +
                " template(s) for the " +
                "writable gdoc types."
        )

        const componentResult = validateExamples(allDocs)
        const templateResult = validateTemplateExamples(templateDocs)
        const failures = [
            ...componentResult.failures,
            ...templateResult.failures,
        ]
        if (failures.length > 0) {
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
        await fs.writeFile(JSON_OUT, JSON.stringify(allDocs, null, 2))
        console.log("Wrote " + path.relative(process.cwd(), JSON_OUT))
        await fs.writeFile(
            TEMPLATES_JSON_OUT,
            JSON.stringify(templateDocs, null, 2)
        )
        console.log("Wrote " + path.relative(process.cwd(), TEMPLATES_JSON_OUT))
    } finally {
        api.close()
    }
}

void main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
