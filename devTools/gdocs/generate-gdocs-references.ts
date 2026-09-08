#!/usr/bin/env node
/*
 * Generate the OWID gdoc references from .md sidecars + the type definitions:
 *   - the ArchieML components reference (one entry per OwidEnrichedGdocBlock)
 *   - the gdoc template reference (one entry per documented OwidGdocType:
 *     front-matter fields from the content interfaces, prose + the curated
 *     skeleton from sidecars)
 *   - the writing guides reference (one entry per guides/*.md sidecar:
 *     cross-cutting concepts that are neither a block nor a document type)
 *
 * Run:
 *     yarn generateGdocsReferences
 *
 * Output:
 *     docs/components.registry.generated.json
 *     docs/templates.registry.generated.json
 *     docs/guides.registry.generated.json
 *
 * Exits non-zero on: missing sidecar, missing "type:" discriminator, an
 * unrecognized or misspelled sidecar section, missing decision prose, an
 * archie example that fails to parse/validate, or a field description that
 * does not match the content interface. The registries are committed; the
 * "gdocs-references" CI job re-runs this generator and fails the build
 * when the committed output is stale or a sidecar is invalid — run the
 * generator locally and commit the result.
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
 *   4. Split the sidecar prose into its declared sections — the vocabulary
 *      lives in ./sidecarSections.ts, and an unrecognized or near-miss
 *      heading fails the build. This is the only place sidecar markdown is
 *      parsed: the registries carry the split prose, so no consumer
 *      re-derives it.
 *   5. Validate every archie example by parsing it through the real
 *      pipeline (archieToEnriched): parser errors fail the build, and an
 *      example that parses to zero blocks is rejected as silently dropped.
 *   6. Harvest the cross-reference mentions in each sidecar's decision prose
 *      into `related` — derived, so the structured links can never drift
 *      from the prose. A mention is a backticked code span and may point at
 *      a component (`{.id}`), a guide (`{guide:id}`) or a template
 *      (`{template:id}`); an unknown id fails the build.
 *
 * Templates pipeline:
 *   1. For each type in GDOC_TEMPLATE_CONTENT_INTERFACES, walk its content
 *      interface (OwidGdocPostContent / OwidGdocDataInsightContent in
 *      Gdoc.ts): field name, declared type text, optionality — each
 *      annotated as authored or computed from the classification consts.
 *   2. Join per-field descriptions from templates/<InterfaceName>.md; every
 *      authored field must be described, and every described field must
 *      exist on the interface.
 *   3. Read prose + front matter from templates/<PascalType>.md. The front
 *      matter must carry the template's curated skeleton (its canonical
 *      structure; component ids validated) — the scaffold for new documents —
 *      and can carry exemplar slugs (editorially chosen published docs,
 *      resolved live by the admin server). Templates hold no synthetic
 *      example documents; a fenced archie block in a template sidecar fails
 *      the build.
 *
 * Guides pipeline:
 *   1. Read every guides/*.md sidecar; the kebab-case file name is the guide
 *      id, and the front matter carries its title and category (one of
 *      GUIDE_CATEGORIES).
 *   2. Split the prose with the "guide" kind — an intro, free-form sections
 *      and "## Notes"; there is no decision prose and no properties table.
 *   3. Harvest the fenced examples per section and validate every one
 *      through the real pipeline — body snippets (archie) as a fragment,
 *      whole documents (archie-document) as they are. A guide's page renders
 *      the fences from its own prose, so the registry's examples exist to be
 *      validated, not to be rendered.
 *   4. Mentions are harvested from the intro and the notes, the sections a
 *      guide reasons in.
 *
 * Completeness is structural: every union member / writable type becomes an
 * entry by iteration, and missing/malformed sidecars fail the build.
 *
 * Uses the TypeScript 7 native compiler (tsgo) API for AST work — the same
 * compiler the rest of the repo uses for yarn typecheck.
 */

import fs from "fs-extra"
import path from "path"
import * as yaml from "yaml"

import { API } from "typescript/unstable/sync"
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
} from "typescript/unstable/ast"
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
} from "typescript/unstable/ast/is"

import { splitSidecarProse } from "./sidecarSections.js"
import {
    assertWellFormedFences,
    harvestExamples,
    hasFence,
} from "./sidecarExamples.js"
import { validateExample } from "./exampleValidation.js"
import {
    findBareKnownIds,
    harvestMentions,
    mentionSyntax,
    resolveMentions,
    type KnownIds,
} from "./mentions.js"
import {
    GDOC_TEMPLATE_CONTENT_INTERFACES,
    GUIDE_CATEGORIES,
    OWID_GDOC_ADMIN_MANAGED_KEYS,
    type ComponentCategory,
    type ComponentReference,
    type ComponentProp,
    type ComponentRegistry,
    type GdocContentKeyKind,
    type GuideCategory,
    type GuideReference,
    type PinnedExampleRef,
    type RelatedRef,
    type SidecarExample,
    type TemplateReference,
    type TemplateField,
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
const GUIDES_DIR = path.resolve(
    REPO_ROOT,
    "packages/@ourworldindata/types/src/gdocTypes/guides"
)
const GUIDES_JSON_OUT = path.join(DOCS_DIR, "guides.registry.generated.json")
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
): ComponentProp[] {
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
): { frontMatter: Record<string, unknown>; body: string } {
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
    const body = rest.trim()
    assertWellFormedFences(body, sidecarPathRel)
    return { frontMatter, body }
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
    autoGenerated?: string
    pinned?: PinnedExampleRef[]
    /**
     * Why the sidecar has no decision prose — required whenever the "## When
     * to use" section is absent, so that a gap reads as what it is:
     * "none" for a block with no authorial choice (an internal primitive, a
     * paragraph, a legacy block), "todo" for guidance still to be written.
     */
    decision?: "none" | "todo"
}

function parseComponentFrontMatter(
    fm: Record<string, unknown>,
    file: string
): ComponentFrontMatter {
    assertAllowedKeys(
        fm,
        ["title", "system", "auto-generated", "pinned", "decision"],
        file
    )
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
    const autoGenerated = fm["auto-generated"]
    if (autoGenerated !== undefined) {
        if (
            typeof autoGenerated !== "string" ||
            autoGenerated.trim().length === 0
        )
            throw new Error(
                file +
                    ": auto-generated must be a non-empty string describing " +
                    "what Google Docs formatting produces the block, got " +
                    inspect(autoGenerated)
            )
        result.autoGenerated = autoGenerated.trim()
    }
    if (fm.decision !== undefined) {
        if (fm.decision !== "none" && fm.decision !== "todo")
            throw new Error(
                file +
                    ': decision must be "none" (the block carries no ' +
                    'authorial choice) or "todo" (guidance still to be ' +
                    "written), got " +
                    inspect(fm.decision)
            )
        result.decision = fm.decision
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

/**
 * Parses the "## Properties" section of a component sidecar: the per-prop
 * effect descriptions (same bullet shape as the template field files) become
 * structured data on the props, so the page renders them in the properties
 * table instead of as a second, prose copy of it.
 *
 * Every component with declared props must carry the section (enforced in
 * the component loop); it must describe every declared prop, and may not
 * name a prop the type does not declare.
 */
function parsePropDescriptions(
    section: string,
    sidecarPathRel: string
): Map<string, string> {
    const descriptions = parseFieldDescriptions(section, sidecarPathRel)
    if (descriptions.size === 0)
        throw new Error(
            sidecarPathRel +
                ": '## Properties' has no `prop`: description bullets"
        )
    return descriptions
}

/**
 * Joins the authored descriptions onto the derived props, failing on either
 * kind of drift: a described prop the type does not declare (typo, rename)
 * or a declared prop left undescribed.
 */
function applyPropDescriptions(
    props: ComponentProp[],
    descriptions: Map<string, string>,
    sidecarPathRel: string
): void {
    if (descriptions.size === 0) return
    const declared = new Set(props.map((prop) => prop.name))
    const unknown = [...descriptions.keys()].filter(
        (name) => !declared.has(name)
    )
    if (unknown.length > 0)
        throw new Error(
            sidecarPathRel +
                " describes unknown propert" +
                (unknown.length === 1 ? "y: " : "ies: ") +
                unknown.join(", ")
        )
    const missing = props
        .filter((prop) => !descriptions.has(prop.name))
        .map((prop) => prop.name)
    if (missing.length > 0)
        throw new Error(
            sidecarPathRel +
                " has a '## Properties' section but leaves propert" +
                (missing.length === 1 ? "y " : "ies ") +
                "undescribed: " +
                missing.join(", ")
        )
    for (const prop of props) prop.description = descriptions.get(prop.name)
}

interface TsProgram {
    getSourceFile(file: string): SourceFile | undefined
}

function openProject(api: InstanceType<typeof API>): {
    program: TsProgram
    rootFiles: readonly string[]
} {
    const snapshot = api.updateSnapshot({ openProjects: [TSCONFIG_PATH] })
    const project = snapshot.getProject(TSCONFIG_PATH)
    if (!project)
        throw new Error("tsgo could not load project at " + TSCONFIG_PATH)
    return { program: project.program, rootFiles: project.rootFiles }
}

// Repo-relative source file of every named type the prop type texts mention,
// so the reference UI can link a type name to its definition on GitHub.
function extractTypeSources(
    components: ComponentReference[],
    typeIndex: TypeIndex
): Record<string, string> {
    const names = new Set<string>()
    for (const component of components)
        for (const prop of component.props)
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

function extractComponentReferences(
    program: TsProgram,
    rootFiles: readonly string[]
): { components: ComponentReference[]; typeSources: Record<string, string> } {
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

    const components: ComponentReference[] = []
    const seenIds = new Set<string>()
    // Sidecars whose front matter admits the decision prose is missing —
    // reported at the end so the backlog stays visible instead of blending
    // into the components that genuinely have nothing to decide.
    const decisionTodos: string[] = []
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
        const { frontMatter, body } = parseSidecar(sidecarText, sidecarPathRel)
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

        // Split the prose into its declared sections once, here: the
        // registry carries the pieces, so the reference page renders them
        // without re-parsing markdown headings.
        const { prose, properties } = splitSidecarProse(
            body,
            sidecarPathRel,
            "component"
        )

        const examples = harvestExamples(prose)
        // Component examples live in the intro (before the first "## "
        // section) — that is where the page renders them. A fence anywhere
        // else is a mistake, caught here rather than silently ignored: in a
        // prose section by the stray check below, and in the "## Properties"
        // section — which the split hands back separately, so no example is
        // ever harvested from it — by the fence check.
        const stray = examples.filter((example) => example.section !== "intro")
        if (stray.length > 0)
            throw new Error(
                sidecarPathRel +
                    ": archie example(s) found after the first '## ' heading — " +
                    "examples belong in the intro, before the decision sections"
            )
        if (hasFence(properties ?? ""))
            throw new Error(
                sidecarPathRel +
                    ": '## Properties' contains a code fence — examples " +
                    "belong in the intro"
            )
        for (const example of examples) {
            if (example.flavour !== "archie")
                throw new Error(
                    sidecarPathRel +
                        ": component examples are body snippets (```archie); " +
                        "whole-document examples belong in guides"
                )
        }
        if (fm.decision) {
            if (prose.whenToUse || prose.whenNotToUse)
                throw new Error(
                    sidecarPathRel +
                        ": front matter says decision: " +
                        fm.decision +
                        ", but the sidecar " +
                        "has decision prose — drop the key or the section(s)"
                )
        } else if (!prose.whenToUse)
            throw new Error(
                sidecarPathRel +
                    ': has no "## When to use" section. Add one, or declare ' +
                    "decision: none in the front matter if the block carries " +
                    "no authorial choice (an internal primitive, a legacy " +
                    "block) — decision: todo if the guidance is simply not " +
                    "written yet"
            )

        // Per-prop effect descriptions live in a "## Properties" section that
        // the page renders as the properties table, not as prose.
        const descriptions = properties
            ? parsePropDescriptions(properties, sidecarPathRel)
            : new Map<string, string>()
        const props = extractProps(decl, typeIndex)
        if (props.length > 0 && descriptions.size === 0)
            throw new Error(
                sidecarPathRel +
                    " has no '## Properties' section — every declared " +
                    "property needs an authored effect description"
            )
        applyPropDescriptions(props, descriptions, sidecarPathRel)

        const title = fm.title ?? deriveTitle(typeName)
        components.push({
            id,
            title,
            typeName,
            category,
            sourceFile,
            sidecarFile: sidecarPathRel,
            prose,
            examples,
            props,
            valueProps: extractValueProps(decl, typeIndex),
            ...(fm.system && { system: true }),
            ...(fm.autoGenerated && { autoGenerated: fm.autoGenerated }),
            ...(fm.pinned && { pinned: fm.pinned }),
        })
        if (fm.decision === "todo") decisionTodos.push(id)
    }
    const staleCategoryIds = Object.keys(COMPONENT_CATEGORY_BY_ID).filter(
        (id) => !seenIds.has(id)
    )
    if (staleCategoryIds.length > 0)
        throw new Error(
            "COMPONENT_CATEGORY_BY_ID has entries for unknown component id(s): " +
                staleCategoryIds.join(", ")
        )
    if (decisionTodos.length > 0)
        console.log(
            decisionTodos.length +
                " component(s) still need decision prose (decision: todo): " +
                decisionTodos.join(", ")
        )
    return {
        components,
        typeSources: extractTypeSources(components, typeIndex),
    }
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
    keyKinds: Record<string, GdocContentKeyKind>
): TemplateField[] {
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

    const fields: TemplateField[] = []
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
        const kind = keyKinds[name]
        if (!kind)
            throw new Error(
                interfaceName +
                    "." +
                    name +
                    " has no authored/computed classification (see Gdoc.ts)"
            )
        const description = descriptions.get(name)
        if (!description && kind === "authored")
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
            kind,
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

function extractTemplateReferences(
    program: TsProgram,
    componentIds: Set<string>
): TemplateReference[] {
    const sf = program.getSourceFile(GDOC_TS)
    if (!sf) throw new Error("Source file not loaded by tsgo: " + GDOC_TS)

    const fieldsByInterface = new Map<string, TemplateField[]>()
    const templates: TemplateReference[] = []
    for (const [type, { interfaceName, keyKinds }] of Object.entries(
        GDOC_TEMPLATE_CONTENT_INTERFACES
    )) {
        const contentTypeName = interfaceName
        let fields = fieldsByInterface.get(contentTypeName)
        if (!fields) {
            fields = extractInterfaceFields(sf, contentTypeName, keyKinds)
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
        const { frontMatter, body } = parseSidecar(
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
        if (hasFence(body))
            throw new Error(
                'Template sidecar for "' +
                    type +
                    '" contains a fenced example — templates are ' +
                    "described by their skeleton, not by example documents"
            )
        const { prose } = splitSidecarProse(body, sidecarPathRel, "template")
        if (!prose.whenToUse)
            throw new Error(
                sidecarPathRel + ': has no "## When to use" section'
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

        templates.push({
            id: type,
            contentTypeName,
            sidecarFile: sidecarPathRel,
            title: fm.title ?? deriveTitle(sidecarName),
            prose,
            fields,
            adminManagedFields: [...OWID_GDOC_ADMIN_MANAGED_KEYS],
            skeleton: fm.skeleton,
            ...(fm.exemplars && { exemplars: fm.exemplars }),
        })
    }
    return templates
}

// ---------------------------------------------------------------------------
// Guides: cross-cutting concepts, one sidecar per guide
// ---------------------------------------------------------------------------

interface GuideFrontMatter {
    title: string
    category: GuideCategory
}

function parseGuideFrontMatter(
    fm: Record<string, unknown>,
    file: string
): GuideFrontMatter {
    assertAllowedKeys(fm, ["title", "category"], file)
    const title = parseOptionalTitle(fm, file)
    if (!title)
        throw new Error(file + ": guides need a title in the front matter")
    if (
        typeof fm.category !== "string" ||
        !(GUIDE_CATEGORIES as readonly string[]).includes(fm.category)
    )
        throw new Error(
            file +
                ": category must be one of " +
                GUIDE_CATEGORIES.map((c) => '"' + c + '"').join(", ") +
                ", got " +
                inspect(fm.category)
        )
    return { title, category: fm.category as GuideCategory }
}

// The card subtitle: the first paragraph of the intro as plain text, code
// spans reduced to their text.
function deriveDescription(intro: string): string {
    return (intro.split(/\n\s*\n/)[0] ?? "")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/\s+/g, " ")
        .trim()
}

function extractGuideReferences(): GuideReference[] {
    if (!fs.existsSync(GUIDES_DIR)) return []
    const files = fs
        .readdirSync(GUIDES_DIR)
        .filter((name) => name.endsWith(".md"))
        .sort()
    const guides: GuideReference[] = []
    for (const fileName of files) {
        const id = fileName.replace(/\.md$/, "")
        if (!/^[a-z0-9-]+$/.test(id))
            throw new Error(
                "guides/" +
                    fileName +
                    ": file name must be kebab-case (it is the guide id)"
            )
        const sidecarPath = path.join(GUIDES_DIR, fileName)
        const sidecarPathRel = path.relative(REPO_ROOT, sidecarPath)
        const { frontMatter, body } = parseSidecar(
            fs.readFileSync(sidecarPath, "utf-8"),
            sidecarPathRel
        )
        if (!body) throw new Error("Guide sidecar is empty: " + sidecarPathRel)
        const fm = parseGuideFrontMatter(frontMatter, sidecarPathRel)
        const { prose } = splitSidecarProse(body, sidecarPathRel, "guide")
        guides.push({
            id,
            title: fm.title,
            category: fm.category,
            sidecarFile: sidecarPathRel,
            description: deriveDescription(prose.intro),
            prose,
            examples: harvestExamples(prose),
        })
    }
    return guides
}

async function main(): Promise<void> {
    const api = new API({ cwd: REPO_ROOT })
    try {
        const { program, rootFiles } = openProject(api)

        const { components: allComponents, typeSources } =
            extractComponentReferences(program, rootFiles)
        allComponents.sort((a, b) => a.title.localeCompare(b.title))
        console.log(
            "Extracted " +
                allComponents.length +
                " component(s) from " +
                UNION_NAME +
                "."
        )

        const templates = extractTemplateReferences(
            program,
            new Set(allComponents.map((component) => component.id))
        )
        console.log(
            "Extracted " +
                templates.length +
                " template(s) for the " +
                "writable gdoc types."
        )

        const guides = extractGuideReferences()
        console.log("Extracted " + guides.length + " guide(s).")

        // Every fenced example of every kind goes through the real pipeline.
        const failures: string[] = []
        const validateAll = (
            label: string,
            examples: SidecarExample[]
        ): void => {
            examples.forEach((example, index) => {
                for (const failure of validateExample(example))
                    failures.push(
                        label + " example #" + (index + 1) + ": " + failure
                    )
            })
        }
        for (const component of allComponents)
            validateAll(component.id, component.examples)
        for (const guide of guides)
            validateAll("guide " + guide.id, guide.examples)
        if (failures.length > 0) {
            console.error(
                "\n" + failures.length + " example(s) failed validation:\n"
            )
            for (const f of failures) console.error("  - " + f)
            process.exitCode = 1
            return
        }
        console.log("All examples validated.")

        // Cross-references, resolved once every id of every kind is known.
        const known: KnownIds = {
            component: new Set(allComponents.map((c) => c.id)),
            guide: new Set(guides.map((g) => g.id)),
            template: new Set(templates.map((t) => t.id)),
        }
        const attachRelated = <T extends { related?: RelatedRef[] }>(
            entry: T,
            texts: (string | undefined)[],
            file: string,
            self: RelatedRef
        ): void => {
            const related = resolveMentions(
                harvestMentions(texts),
                known,
                file,
                self
            )
            if (related.length > 0) entry.related = related
        }
        for (const component of allComponents)
            attachRelated(
                component,
                [
                    component.prose.intro,
                    component.prose.whenToUse,
                    component.prose.whenNotToUse,
                    component.prose.notes,
                ],
                component.sidecarFile,
                { kind: "component", id: component.id }
            )
        for (const template of templates)
            attachRelated(
                template,
                [
                    template.prose.intro,
                    template.prose.whenToUse,
                    template.prose.whenNotToUse,
                    template.prose.notes,
                    ...template.fields.map((field) => field.description),
                ],
                template.sidecarFile,
                { kind: "template", id: template.id }
            )
        for (const guide of guides)
            attachRelated(
                guide,
                [guide.prose.intro, guide.prose.notes],
                guide.sidecarFile,
                { kind: "guide", id: guide.id }
            )

        // Lint: a bare known id in rendered prose (not written as an explicit
        // mention) fails the build naming the explicit form to use — one
        // linking syntax, no bare-id path for authors to remember.
        const bareIdErrors: string[] = []
        const lintBareIds = (
            file: string,
            texts: (string | undefined)[]
        ): void => {
            for (const { id, kind } of findBareKnownIds(texts, known))
                bareIdErrors.push(
                    file +
                        ": bare id `" +
                        id +
                        "` — write `" +
                        mentionSyntax({ kind, id }) +
                        "` so it links"
                )
        }
        for (const component of allComponents)
            lintBareIds(component.sidecarFile, [
                component.prose.intro,
                component.prose.whenToUse,
                component.prose.whenNotToUse,
                component.prose.notes,
            ])
        for (const template of templates)
            lintBareIds(template.sidecarFile, [
                template.prose.intro,
                template.prose.whenToUse,
                template.prose.whenNotToUse,
                template.prose.notes,
                ...template.fields.map((field) => field.description),
            ])
        for (const guide of guides)
            lintBareIds(guide.sidecarFile, [
                guide.prose.intro,
                guide.prose.notes,
            ])
        if (bareIdErrors.length > 0) {
            console.error(
                "\n" + bareIdErrors.length + " bare known id(s) found:\n"
            )
            for (const e of bareIdErrors) console.error("  - " + e)
            process.exitCode = 1
            return
        }

        await fs.ensureDir(DOCS_DIR)
        const registry: ComponentRegistry = {
            components: allComponents,
            typeSources,
        }
        await fs.writeFile(JSON_OUT, JSON.stringify(registry, null, 2))
        console.log("Wrote " + path.relative(process.cwd(), JSON_OUT))
        await fs.writeFile(
            TEMPLATES_JSON_OUT,
            JSON.stringify(templates, null, 2)
        )
        console.log("Wrote " + path.relative(process.cwd(), TEMPLATES_JSON_OUT))
        await fs.writeFile(GUIDES_JSON_OUT, JSON.stringify(guides, null, 2))
        console.log("Wrote " + path.relative(process.cwd(), GUIDES_JSON_OUT))
    } finally {
        api.close()
    }
}

void main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
