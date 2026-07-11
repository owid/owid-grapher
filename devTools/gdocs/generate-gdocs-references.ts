#!/usr/bin/env node
/*
 * Generate the OWID gdoc references from .md sidecars + the type definitions:
 *   - the ArchieML components reference (one entry per OwidEnrichedGdocBlock)
 *   - the gdoc template reference (one entry per writable OwidGdocType:
 *     front-matter fields from the content interfaces, prose + the curated
 *     skeleton from sidecars)
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
 *      alias minus the EnrichedBlock prefix), parse front-matter (title,
 *      system flag, pinned real-example refs) + harvest every fenced archie
 *      block, and derive the id from the alias body's "type" property
 *      literal.
 *   4. Validate every archie example through validateArchieMl — the same
 *      gate the write API applies (parse, block errors, fixed point).
 *   5. Harvest the {.component-id} cross-references in each sidecar's
 *      "## When (NOT) to use" prose into `related` — derived, so the
 *      structured links can never drift from the prose.
 *
 * Templates pipeline:
 *   1. For each type in ARCHIE_WRITABLE_GDOC_TYPES, walk its content
 *      interface (OwidGdocPostContent / OwidGdocDataInsightContent in
 *      Gdoc.ts): field name, declared type text, optionality — each
 *      annotated with its write-back fate from the classification consts.
 *   2. Join per-field descriptions from templates/<InterfaceName>.md; every
 *      non-derived field must be described, and every described field must
 *      exist on the interface.
 *   3. Read prose + front matter from templates/<PascalType>.md. The front
 *      matter must carry the template's curated skeleton (its canonical
 *      structure; component ids validated) — the scaffold for new documents —
 *      and can carry exemplar slugs (editorially chosen published docs,
 *      resolved live by the admin server). Templates hold no synthetic
 *      example documents; a fenced archie block in a template sidecar fails
 *      the build.
 *
 * Completeness is structural: every union member / writable type becomes an
 * entry by iteration, and missing/malformed sidecars fail the build.
 *
 * Uses @typescript/native-preview (tsgo) for AST work — the same compiler
 * the rest of the repo uses for yarn typecheck.
 */

import fs from "fs-extra"
import path from "path"
import * as yaml from "yaml"

import { API } from "@typescript/native-preview/sync"
import type {
    EnumDeclaration,
    Identifier,
    InterfaceDeclaration,
    Node,
    PropertyName,
    SourceFile,
    TypeAliasDeclaration,
    TypeNode,
    VariableDeclaration,
} from "@typescript/native-preview/ast"
import {
    isArrayLiteralExpression,
    isAsExpression,
    isComputedPropertyName,
    isEnumDeclaration,
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
    isVariableStatement,
} from "@typescript/native-preview/ast/is"

import {
    ARCHIE_WRITABLE_GDOC_TYPES,
    validateArchieMl,
} from "../../db/model/Gdoc/validateArchieMl.js"
import {
    getContentKeysForGdocType,
    OWID_GDOC_ADMIN_MANAGED_KEYS,
    OWID_GDOC_ANNOUNCEMENT_CONTENT_KEYS,
    OWID_GDOC_POST_CONTENT_KEYS,
    type ComponentCategory,
    type ComponentDoc,
    type ComponentExample,
    type ComponentPropDoc,
    type ComponentRegistry,
    type GdocContentKeyFate,
    type PinnedExampleRef,
    type TemplateDoc,
    type TemplateFieldDoc,
    type TemplateSkeletonPart,
} from "@ourworldindata/types"

// Author-facing grouping used by the admin reference page. Every component id
// must appear here exactly once — a new member of OwidEnrichedGdocBlock fails
// the build until it is categorized, and a stale entry (e.g. after a rename)
// fails it too.
const COMPONENT_CATEGORY_BY_ID: Record<string, ComponentCategory> = {
    // Text & structure
    text: "Text & structure",
    heading: "Text & structure",
    "simple-text": "Text & structure",
    list: "Text & structure",
    "numbered-list": "Text & structure",
    blockquote: "Text & structure",
    "pull-quote": "Text & structure",
    callout: "Text & structure",
    aside: "Text & structure",
    "horizontal-rule": "Text & structure",
    table: "Text & structure",
    "expandable-paragraph": "Text & structure",
    expander: "Text & structure",
    code: "Text & structure",
    html: "Text & structure",
    // Charts & data
    chart: "Charts & data",
    "narrative-chart": "Charts & data",
    "pull-chart": "Charts & data",
    "guided-chart": "Charts & data",
    "chart-story": "Charts & data",
    "chart-rows": "Charts & data",
    "static-viz": "Charts & data",
    "key-indicator": "Charts & data",
    "key-indicator-collection": "Charts & data",
    "missing-data": "Charts & data",
    "data-callout": "Charts & data",
    "data-callout-group": "Charts & data",
    // Media
    image: "Media",
    video: "Media",
    // Layout & sections
    "side-by-side": "Layout & sections",
    "sticky-left": "Layout & sections",
    "sticky-right": "Layout & sections",
    "gray-section": "Layout & sections",
    align: "Layout & sections",
    "conditional-section": "Layout & sections",
    // Links & related content
    "prominent-link": "Links & related content",
    recirc: "Links & related content",
    "additional-charts": "Links & related content",
    "all-charts": "Links & related content",
    "explorer-tiles": "Links & related content",
    "resource-panel": "Links & related content",
    "pill-row": "Links & related content",
    cta: "Links & related content",
    "subscribe-banner": "Links & related content",
    "latest-data-insights": "Links & related content",
    "featured-data-insights": "Links & related content",
    // Topic pages
    "topic-page-intro": "Topic pages",
    "key-insights": "Topic pages",
    "entry-summary": "Topic pages",
    "research-and-writing": "Topic pages",
    "ltp-toc": "Topic pages",
    "sdg-grid": "Topic pages",
    "sdg-toc": "Topic pages",
    "explore-data-section": "Topic pages",
    // People
    people: "People",
    "people-rows": "People",
    person: "People",
    donors: "People",
    // Special pages
    "homepage-intro": "Special pages",
    "homepage-search": "Special pages",
    "featured-metrics": "Special pages",
    "cookie-notice": "Special pages",
    "country-profile-selector": "Special pages",
    "bespoke-component": "Special pages",
    socials: "Special pages",
}

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

interface TypeIndex {
    aliases: Map<string, TypeAliasDeclaration>
    enums: Map<string, EnumDeclaration>
    /** Only consulted for typeSources — blocks themselves are always aliases */
    interfaces: Map<string, InterfaceDeclaration>
    /** 'const xs = ["a", "b"] as const' arrays backing (typeof xs)[number] aliases */
    constArrays: Map<string, string[]>
}

// The values of a 'const xs = ["a", "b"] as const' declaration; undefined for
// any other shape of variable declaration.
function constStringArrayValues(
    decl: VariableDeclaration
): string[] | undefined {
    const initializer = decl.initializer
    if (!initializer || !isAsExpression(initializer)) return undefined
    const expression = initializer.expression
    if (!isArrayLiteralExpression(expression)) return undefined
    const values: string[] = []
    for (const element of expression.elements) {
        if (!isStringLiteral(element)) return undefined
        values.push(element.text)
    }
    return values
}

function buildTypeIndex(
    program: { getSourceFile(file: string): SourceFile | undefined },
    sourceFiles: readonly { fileName: string }[]
): TypeIndex {
    const aliases = new Map<string, TypeAliasDeclaration>()
    const enums = new Map<string, EnumDeclaration>()
    const interfaces = new Map<string, InterfaceDeclaration>()
    const constArrays = new Map<string, string[]>()
    // The whole gdocTypes dir, not just archieMLComponents/ — value-prop
    // classification resolves referenced types (HorizontalAlign, …) that
    // live next door.
    const gdocTypesDir = path.dirname(COMPONENTS_DIR)
    for (const { fileName } of sourceFiles) {
        if (!fileName.startsWith(gdocTypesDir + path.sep)) continue
        if (!fileName.endsWith(".ts") || fileName.endsWith(".test.ts")) continue
        const sf = program.getSourceFile(fileName)
        if (!sf) continue
        sf.forEachChild((node: Node) => {
            if (isTypeAliasDeclaration(node)) {
                aliases.set(node.name.text, node)
            }
            if (isEnumDeclaration(node)) {
                enums.set(node.name.text, node)
            }
            if (isInterfaceDeclaration(node)) {
                interfaces.set(node.name.text, node)
            }
            if (isVariableStatement(node)) {
                for (const decl of node.declarationList.declarations) {
                    const values = constStringArrayValues(decl)
                    if (values && isIdentifier(decl.name))
                        constArrays.set(decl.name.text, values)
                }
            }
            return undefined
        })
    }
    return { aliases, enums, interfaces, constArrays }
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

// Collect the (name, type, optionality) property signatures declared directly
// on a block alias — recursing through intersections, which is how blocks
// compose with EnrichedBlockWithParseErrors.
function collectPropertySignatures(
    typeNode: TypeNode,
    into: { name: string; type: TypeNode; optional: boolean }[]
): void {
    if (isIntersectionTypeNode(typeNode)) {
        for (const member of typeNode.types)
            collectPropertySignatures(member, into)
        return
    }
    if (!isTypeLiteralNode(typeNode)) return
    for (const member of typeNode.members) {
        if (!isPropertySignatureDeclaration(member)) continue
        const name = propertyNameText(member.name)
        if (name === undefined || member.type === undefined) continue
        into.push({
            name,
            type: member.type,
            optional: member.postfixToken !== undefined,
        })
    }
}

// Is every branch of the type text a quoted string literal? Matches both a
// lone literal ('"info"') and a union ('"wide" | "narrow"').
function isLiteralUnionText(text: string): boolean {
    const branches = text.split("|").map((branch) => branch.trim())
    return (
        branches.length > 0 &&
        branches.every((branch) => /^(['"]).*\1$/.test(branch))
    )
}

/**
 * Whether a prop's VALUE (rather than its mere presence) distinguishes forms
 * of a block, decided from the declared type: choices among a fixed set
 * (literal unions, enums, const-array unions), numbers (a heading's level),
 * and booleans (which only ever survive source-minimization with their
 * non-default value, so the value is the information). Free-form strings and
 * span/block content are presence-only.
 */
function isValuePropType(
    typeText: string,
    typeIndex: TypeIndex,
    depth = 0
): boolean {
    const text = typeText.trim()
    if (text === "number" || text === "boolean") return true
    if (isLiteralUnionText(text)) return true
    // e.g. (typeof blockVisibilitys)[number] — one of a fixed const array
    if (/^\(typeof \w+\)\[number\]$/.test(text)) return true
    if (/^\w+$/.test(text) && depth < 3) {
        if (typeIndex.enums.has(text)) return true
        const alias = typeIndex.aliases.get(text)
        if (alias)
            return isValuePropType(
                declaredTypeText(alias.getSourceFile(), alias.type),
                typeIndex,
                depth + 1
            )
    }
    return false
}

// Props that exist on every block and are never authoring choices.
const NON_VALUE_PROPS = new Set(["type", "parseErrors"])

function extractValueProps(
    decl: TypeAliasDeclaration,
    typeIndex: TypeIndex
): string[] {
    const signatures: { name: string; type: TypeNode; optional: boolean }[] = []
    collectPropertySignatures(decl.type, signatures)
    const sf = decl.getSourceFile()
    return signatures
        .filter(
            ({ name, type }) =>
                !NON_VALUE_PROPS.has(name) &&
                isValuePropType(declaredTypeText(sf, type), typeIndex)
        )
        .map(({ name }) => name)
        .sort()
}

// Every declared property of the block, in declaration order — the derived,
// exhaustive source behind the component page's properties table ("title is
// optional" is the type's fact to state, not a sidecar author's). A bare
// type-alias reference standing for a fixed choice resolves to its literal
// values ('BlockSize' → '"narrow" | "wide" | …'), so the table states the
// choices, not a name to chase.
function extractProps(
    decl: TypeAliasDeclaration,
    typeIndex: TypeIndex
): ComponentPropDoc[] {
    const signatures: { name: string; type: TypeNode; optional: boolean }[] = []
    collectPropertySignatures(decl.type, signatures)
    const sf = decl.getSourceFile()
    const resolveTypeText = (text: string, depth = 0): string => {
        // e.g. (typeof blockVisibilitys)[number] — one of a fixed const array
        const constArrayRef = /^\(typeof (\w+)\)\[number\]$/.exec(text)
        if (constArrayRef) {
            const values = typeIndex.constArrays.get(constArrayRef[1])
            if (values) return values.map((value) => `"${value}"`).join(" | ")
        }
        if (!/^\w+$/.test(text)) return text
        const enumDecl = typeIndex.enums.get(text)
        if (enumDecl) {
            const values: string[] = []
            for (const member of enumDecl.members) {
                if (member.initializer && isStringLiteral(member.initializer))
                    values.push(`"${member.initializer.text}"`)
            }
            if (values.length > 0) return values.join(" | ")
        }
        const alias = typeIndex.aliases.get(text)
        if (!alias || depth >= 3) return text
        const resolved = resolveTypeText(
            declaredTypeText(alias.getSourceFile(), alias.type),
            depth + 1
        )
        return isLiteralUnionText(resolved) ? resolved : text
    }
    return signatures
        .filter(({ name }) => !NON_VALUE_PROPS.has(name))
        .map(({ name, type, optional }) => ({
            name,
            type: resolveTypeText(declaredTypeText(sf, type)),
            optional,
        }))
}

function deriveTitle(aliasName: string): string {
    const stripped = aliasName.replace(/^(Enriched|Raw)Block/, "")
    return stripped
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
}

function parseSidecar(
    text: string,
    sidecarPathRel: string
): {
    frontMatter: Record<string, unknown>
    body: string
    examples: (ComponentExample & { inIntro: boolean })[]
} {
    let rest = text
    let frontMatter: Record<string, unknown> = {}
    const fmMatch = /^---\r?\n([\s\S]+?)\r?\n---\r?\n/.exec(rest)
    if (fmMatch) {
        let parsed: unknown
        try {
            parsed = yaml.parse(fmMatch[1])
        } catch (err) {
            throw new Error(
                sidecarPathRel +
                    " has invalid YAML front matter: " +
                    (err instanceof Error ? err.message : String(err)),
                { cause: err }
            )
        }
        if (parsed === null || parsed === undefined) parsed = {}
        if (typeof parsed !== "object" || Array.isArray(parsed))
            throw new Error(
                sidecarPathRel + " front matter is not a YAML mapping"
            )
        frontMatter = parsed as Record<string, unknown>
        rest = rest.slice(fmMatch[0].length)
    }
    rest = rest.trim()

    const examples: (ComponentExample & { inIntro: boolean })[] = []
    const sectionsStart = rest.search(/^## /m)
    const fenceRe = new RegExp(
        FENCE + "archie\\r?\\n([\\s\\S]+?)\\r?\\n" + FENCE,
        "g"
    )
    let m: RegExpExecArray | null
    while ((m = fenceRe.exec(rest)) !== null) {
        examples.push({
            archie: m[1],
            inIntro: sectionsStart === -1 || m.index < sectionsStart,
        })
    }
    return { frontMatter, body: rest, examples }
}

// ---------------------------------------------------------------------------
// Sidecar front-matter validation
// ---------------------------------------------------------------------------

// A gdoc slug as referenced from front matter: existence in the database is
// checked live by the admin server (CI has no DB), so only well-formedness is
// enforced here.
function assertWellFormedSlug(
    value: unknown,
    what: string,
    file: string
): string {
    if (typeof value !== "string" || value.length === 0 || /[\s#]/.test(value))
        throw new Error(
            file + ": " + what + " must be a gdoc slug, got " + inspect(value)
        )
    return value
}

function inspect(value: unknown): string {
    return JSON.stringify(value) ?? String(value)
}

function assertAllowedKeys(
    fm: Record<string, unknown>,
    allowed: string[],
    file: string
): void {
    for (const key of Object.keys(fm)) {
        if (!allowed.includes(key))
            throw new Error(
                file +
                    ' has unknown front-matter key "' +
                    key +
                    '" — allowed: ' +
                    allowed.join(", ")
            )
    }
}

function parseOptionalTitle(
    fm: Record<string, unknown>,
    file: string
): string | undefined {
    if (fm.title === undefined) return undefined
    if (typeof fm.title !== "string" || fm.title.trim().length === 0)
        throw new Error(file + ": title must be a non-empty string")
    return fm.title.trim()
}

interface ComponentFrontMatter {
    title?: string
    system?: boolean
    pinned?: PinnedExampleRef[]
}

function parseComponentFrontMatter(
    fm: Record<string, unknown>,
    file: string
): ComponentFrontMatter {
    assertAllowedKeys(fm, ["title", "system", "pinned"], file)
    const result: ComponentFrontMatter = { title: parseOptionalTitle(fm, file) }
    if (fm.system !== undefined) {
        if (fm.system !== true)
            throw new Error(
                file +
                    ": system must be true (omit the key for regular components), got " +
                    inspect(fm.system)
            )
        result.system = true
    }
    if (fm.pinned !== undefined) {
        if (!Array.isArray(fm.pinned) || fm.pinned.length === 0)
            throw new Error(file + ": pinned must be a non-empty list")
        result.pinned = fm.pinned.map((entry, i): PinnedExampleRef => {
            const what = "pinned[" + i + "]"
            if (typeof entry !== "object" || entry === null)
                throw new Error(
                    file + ": " + what + " must be a { slug, nth? } mapping"
                )
            const { slug, nth, ...unknownKeys } = entry as Record<
                string,
                unknown
            >
            if (Object.keys(unknownKeys).length > 0)
                throw new Error(
                    file +
                        ": " +
                        what +
                        " has unknown key(s): " +
                        Object.keys(unknownKeys).join(", ")
                )
            const ref: PinnedExampleRef = {
                slug: assertWellFormedSlug(slug, what + ".slug", file),
            }
            if (nth !== undefined) {
                if (!Number.isInteger(nth) || (nth as number) < 1)
                    throw new Error(
                        file +
                            ": " +
                            what +
                            ".nth must be a positive integer (1-based), got " +
                            inspect(nth)
                    )
                ref.nth = nth as number
            }
            return ref
        })
    }
    return result
}

interface TemplateFrontMatter {
    title?: string
    exemplars?: string[]
    skeleton?: TemplateSkeletonPart[]
}

function parseTemplateFrontMatter(
    fm: Record<string, unknown>,
    file: string
): TemplateFrontMatter {
    assertAllowedKeys(fm, ["title", "exemplars", "skeleton"], file)
    const result: TemplateFrontMatter = { title: parseOptionalTitle(fm, file) }
    if (fm.exemplars !== undefined) {
        if (
            !Array.isArray(fm.exemplars) ||
            fm.exemplars.length === 0 ||
            fm.exemplars.length > 2
        )
            throw new Error(file + ": exemplars must list 1-2 gdoc slugs")
        result.exemplars = fm.exemplars.map((slug, i) =>
            assertWellFormedSlug(slug, "exemplars[" + i + "]", file)
        )
    }
    if (fm.skeleton !== undefined) {
        if (!Array.isArray(fm.skeleton) || fm.skeleton.length === 0)
            throw new Error(file + ": skeleton must be a non-empty list")
        result.skeleton = fm.skeleton.map((part, i): TemplateSkeletonPart => {
            const what = "skeleton[" + i + "]"
            if (typeof part !== "object" || part === null)
                throw new Error(
                    file +
                        ": " +
                        what +
                        " must be a { name, description, components, repeats? } mapping"
                )
            const { name, description, components, repeats, ...unknownKeys } =
                part as Record<string, unknown>
            if (Object.keys(unknownKeys).length > 0)
                throw new Error(
                    file +
                        ": " +
                        what +
                        " has unknown key(s): " +
                        Object.keys(unknownKeys).join(", ")
                )
            if (typeof name !== "string" || name.trim().length === 0)
                throw new Error(
                    file + ": " + what + ".name must be a non-empty string"
                )
            if (
                typeof description !== "string" ||
                description.trim().length === 0
            )
                throw new Error(
                    file +
                        ": " +
                        what +
                        ".description must be a non-empty string"
                )
            if (
                !Array.isArray(components) ||
                components.length === 0 ||
                components.some((id) => typeof id !== "string")
            )
                throw new Error(
                    file +
                        ": " +
                        what +
                        ".components must be a non-empty list of component ids"
                )
            const parsed: TemplateSkeletonPart = {
                name: name.trim(),
                description: description.trim(),
                components: components as string[],
            }
            if (repeats !== undefined) {
                if (repeats !== true)
                    throw new Error(
                        file +
                            ": " +
                            what +
                            ".repeats must be true (omit the key otherwise)"
                    )
                parsed.repeats = true
            }
            return parsed
        })
    }
    return result
}

// The decision prose in a sidecar ("## When to use" / "## When NOT to use")
// cross-references alternatives as {.component-id}. Harvest those mentions
// into ComponentDoc.related — derived, so it can never drift from the prose.
function deriveRelatedComponents(
    body: string,
    selfId: string,
    validIds: Set<string>
): string[] {
    const related: string[] = []
    for (const section of body.split(/^(?=## )/m)) {
        if (!/^## When (NOT )?to use/i.test(section)) continue
        for (const match of section.matchAll(/\{\.([a-z0-9-]+)\}/g)) {
            const id = match[1]
            if (id === selfId || !validIds.has(id)) continue
            if (!related.includes(id)) related.push(id)
        }
    }
    return related
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
        for (const [index, ex] of doc.examples.entries()) {
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
                        " example #" +
                        (index + 1) +
                        ":\n    " +
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
                        " example #" +
                        (index + 1) +
                        ": parsed to zero body blocks — the example is silently dropped by the parser"
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

// Repo-relative source file of every named type the prop type texts mention,
// so the reference UI can link a type name to its definition on GitHub.
function extractTypeSources(
    docs: ComponentDoc[],
    typeIndex: TypeIndex
): Record<string, string> {
    const names = new Set<string>()
    for (const doc of docs)
        for (const prop of doc.props)
            for (const match of prop.type.matchAll(/[A-Za-z_]\w*/g))
                names.add(match[0])
    const sources: Record<string, string> = {}
    for (const name of [...names].sort()) {
        const decl =
            typeIndex.aliases.get(name) ??
            typeIndex.enums.get(name) ??
            typeIndex.interfaces.get(name)
        if (decl)
            sources[name] = path.relative(
                REPO_ROOT,
                decl.getSourceFile().fileName
            )
    }
    return sources
}

function extractComponentDocs(
    program: TsProgram,
    rootFiles: readonly string[]
): { docs: ComponentDoc[]; typeSources: Record<string, string> } {
    const sf = program.getSourceFile(ARCHIE_ML_COMPONENTS_TS)
    if (!sf)
        throw new Error(
            "Source file not loaded by tsgo: " + ARCHIE_ML_COMPONENTS_TS
        )

    const typeIndex = buildTypeIndex(
        program,
        rootFiles.map((fileName) => ({ fileName }))
    )
    const aliasIndex = typeIndex.aliases

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
        const sidecarPathRel = path.relative(REPO_ROOT, sidecarPath)
        const { frontMatter, body, examples } = parseSidecar(
            sidecarText,
            sidecarPathRel
        )
        if (!body)
            throw new Error(typeName + " sidecar is empty: " + sidecarPathRel)
        const fm = parseComponentFrontMatter(frontMatter, sidecarPathRel)

        const category = COMPONENT_CATEGORY_BY_ID[id]
        if (!category)
            throw new Error(
                'Component "' +
                    id +
                    '" has no category — add it to ' +
                    "COMPONENT_CATEGORY_BY_ID in devTools/gdocs/generate-gdocs-references.ts"
            )

        // Component examples live in the intro (before the first "## "
        // section) — that is where the page renders them. A fence anywhere
        // else is a mistake, caught here rather than silently ignored.
        const stray = examples.filter((example) => !example.inIntro)
        if (stray.length > 0)
            throw new Error(
                sidecarPathRel +
                    ": archie example(s) found after the first '## ' heading — " +
                    "examples belong in the intro, before the decision sections"
            )

        const title = fm.title ?? deriveTitle(typeName)
        docs.push({
            id,
            title,
            typeName,
            category,
            sourceFile,
            sidecarFile: sidecarPathRel,
            body,
            examples: examples.map(({ archie }) => ({ archie })),
            props: extractProps(decl, typeIndex),
            valueProps: extractValueProps(decl, typeIndex),
            ...(fm.system && { system: true }),
            ...(fm.pinned && { pinned: fm.pinned }),
        })
    }
    const staleCategoryIds = Object.keys(COMPONENT_CATEGORY_BY_ID).filter(
        (id) => !seenIds.has(id)
    )
    if (staleCategoryIds.length > 0)
        throw new Error(
            "COMPONENT_CATEGORY_BY_ID has entries for unknown component id(s): " +
                staleCategoryIds.join(", ")
        )
    // Second pass, once every id is known: harvest the {.component-id}
    // cross-references in each doc's decision prose into `related`.
    for (const doc of docs) {
        const related = deriveRelatedComponents(doc.body, doc.id, seenIds)
        if (related.length > 0) doc.related = related
    }
    return { docs, typeSources: extractTypeSources(docs, typeIndex) }
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

function extractTemplateDocs(
    program: TsProgram,
    componentIds: Set<string>
): TemplateDoc[] {
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
                : keyFates === OWID_GDOC_ANNOUNCEMENT_CONTENT_KEYS
                  ? "OwidGdocAnnouncementContent"
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
        const sidecarPathRel = path.relative(REPO_ROOT, sidecarPath)
        const { frontMatter, body, examples } = parseSidecar(
            fs.readFileSync(sidecarPath, "utf-8"),
            sidecarPathRel
        )
        if (!body)
            throw new Error(
                'Template sidecar for "' +
                    type +
                    '" is empty: ' +
                    sidecarPathRel
            )
        // Templates carry no synthetic example documents: the skeleton is the
        // scaffold, and real structure comes live from the exemplars endpoint.
        if (examples.length > 0)
            throw new Error(
                'Template sidecar for "' +
                    type +
                    '" contains a fenced archie example — templates are ' +
                    "described by their skeleton, not by example documents"
            )
        const fm = parseTemplateFrontMatter(frontMatter, sidecarPathRel)
        if (!fm.skeleton)
            throw new Error(
                'Template sidecar for "' +
                    type +
                    '" has no skeleton in its front matter'
            )
        for (const part of fm.skeleton ?? []) {
            for (const componentId of part.components) {
                if (!componentIds.has(componentId))
                    throw new Error(
                        sidecarPathRel +
                            ': skeleton part "' +
                            part.name +
                            '" references unknown component id "' +
                            componentId +
                            '"'
                    )
            }
        }

        docs.push({
            id: type,
            contentTypeName,
            sidecarFile: sidecarPathRel,
            title: fm.title ?? deriveTitle(sidecarName),
            body,
            fields,
            adminManagedFields: [...OWID_GDOC_ADMIN_MANAGED_KEYS],
            skeleton: fm.skeleton,
            ...(fm.exemplars && { exemplars: fm.exemplars }),
        })
    }
    return docs
}

async function main(): Promise<void> {
    const api = new API({ cwd: REPO_ROOT })
    try {
        const { program, rootFiles } = openProject(api)

        const { docs: allDocs, typeSources } = extractComponentDocs(
            program,
            rootFiles
        )
        allDocs.sort((a, b) => a.title.localeCompare(b.title))
        console.log(
            "Extracted " +
                allDocs.length +
                " component(s) from " +
                UNION_NAME +
                "."
        )

        const templateDocs = extractTemplateDocs(
            program,
            new Set(allDocs.map((doc) => doc.id))
        )
        console.log(
            "Extracted " +
                templateDocs.length +
                " template(s) for the " +
                "writable gdoc types."
        )

        const { failures } = validateExamples(allDocs)
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
        const registry: ComponentRegistry = {
            components: allDocs,
            typeSources,
        }
        await fs.writeFile(JSON_OUT, JSON.stringify(registry, null, 2))
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
