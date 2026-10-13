/*
 * What the bespoke viz registry may say about a bundle.
 *
 * Takes a bundle's VARIANTS and CONFIG_SPEC as plain data (already read from
 * its src/index.tsx by bespokeVizReferences.ts) plus the text of its optional
 * docs.md, and builds the registry entry. Every declaration the reference
 * would get wrong is a build error: a missing description, a duplicate
 * variant, a default value the spec does not allow, a default block that
 * does not parse, or a docs.md example that does not match the bundle.
 *
 * Kept free of AST work so that every check is testable on plain objects.
 * Checks the bespoke typecheck already makes through `satisfies` (field
 * types, enum without values, custom without format, …) are not repeated.
 */

import {
    type BlockSize,
    type BundleConfigField,
    type BundleConfigFieldType,
    type BundleReference,
    type BundleVariantReference,
    type BundleVariantSize,
    type OwidEnrichedGdocBlock,
    type SidecarExample,
    type SidecarProse,
} from "@ourworldindata/types"
import {
    archieToEnriched,
    OwidRawGdocBlockToArchieMLString,
} from "@ourworldindata/gdoc-pipeline"

import { validateExample } from "./exampleValidation.js"
import { harvestExamples } from "./sidecarExamples.js"
import { parseSidecar } from "./sidecarFiles.js"
import { splitSidecarProse } from "./sidecarSections.js"

/** A VARIANTS entry, as read from the source (`component` is never read) */
export interface DeclaredVariant {
    name: string
    description?: string
    defaultSize?: BundleVariantSize
}

/** A CONFIG_SPEC entry, as read from the source (`parse` is never read) */
export interface DeclaredConfigField {
    name: string
    type: BundleConfigFieldType
    values?: string[]
    format?: string
    description?: string
    default?: string
}

export interface BundleDeclarations {
    /** Registry key */
    id: string
    /** Repo-relative path of src/index.tsx, named in every error */
    entryFile: string
    variants: DeclaredVariant[]
    config: DeclaredConfigField[]
    /** The bundle's docs.md, if it has one */
    docs?: { file: string; text: string }
}

function isBlank(value: string | undefined): boolean {
    return value === undefined || value.trim().length === 0
}

/**
 * Why a config value is not one the bundle accepts — the one checker behind
 * spec defaults and docs.md example configs. Only
 * enums have a closed set of values to check against.
 */
function configValueFailure(
    field: DeclaredConfigField,
    value: string
): string | undefined {
    if (field.type === "enum" && !(field.values ?? []).includes(value))
        return (
            '"' +
            value +
            '" is not one of the allowed values: ' +
            (field.values ?? []).join(", ")
        )
    return undefined
}

/** Failures of a docs.md example's config */
function configFailures(
    config: Record<string, string>,
    fieldsByName: Map<string, DeclaredConfigField>
): string[] {
    const failures: string[] = []
    for (const [key, value] of Object.entries(config)) {
        const field = fieldsByName.get(key)
        if (!field) {
            failures.push(
                'unknown config key "' +
                    key +
                    '" — not in CONFIG_SPEC (keys: ' +
                    [...fieldsByName.keys()].join(", ") +
                    ")"
            )
            continue
        }
        const failure = configValueFailure(field, value)
        if (failure) failures.push("config " + key + ": " + failure)
    }
    return failures
}

/** The block an author copies to place this variant */
function defaultVariantArchie(
    bundle: string,
    variant: string,
    size: BundleVariantSize
): string {
    return OwidRawGdocBlockToArchieMLString({
        type: "bespoke-component",
        value: { bundle, variant, size: size as BlockSize },
    })
}

function parseBody(archie: string): OwidEnrichedGdocBlock[] {
    const wrapped =
        "title: Example\ntype: fragment\n[+body]\n" + archie + "\n[]\n"
    const content = archieToEnriched(wrapped) as unknown as {
        body?: OwidEnrichedGdocBlock[]
    }
    return content.body ?? []
}

/** Failures of a docs.md example, beyond parsing: it must place this bundle */
function exampleFailures(
    example: SidecarExample,
    id: string,
    variantNames: Set<string>,
    fieldsByName: Map<string, DeclaredConfigField>
): string[] {
    if (example.flavour === "archie-document")
        return [
            "archie-document examples are not supported — a bundle " +
                "example is a single {.bespoke-component} block (```archie)",
        ]
    const parseFailures = validateExample(example)
    if (parseFailures.length > 0) return parseFailures
    const blocks = parseBody(example.archie)
    if (blocks.length !== 1 || blocks[0].type !== "bespoke-component")
        return [
            "must be exactly one {.bespoke-component} block, got " +
                blocks.map((block) => "[" + block.type + "]").join(", "),
        ]
    const block = blocks[0]
    if (block.bundle !== id)
        return ['bundle is "' + block.bundle + '", not "' + id + '"']
    const failures: string[] = []
    if (block.variant === undefined)
        failures.push(
            "has no variant — one of: " + [...variantNames].join(", ")
        )
    else if (!variantNames.has(block.variant))
        failures.push(
            'unknown variant "' +
                block.variant +
                '" — one of: ' +
                [...variantNames].join(", ")
        )
    failures.push(...configFailures(block.config, fieldsByName))
    return failures
}

interface ParsedDocs {
    prose: SidecarProse
    examples: SidecarExample[]
}

function parseDocs(file: string, text: string): ParsedDocs {
    const { frontMatter, body } = parseSidecar(text, file)
    // The bundle id is its title, so docs.md has nothing to set up top
    if (Object.keys(frontMatter).length > 0)
        throw new Error(file + " takes no front matter")
    const { prose } = splitSidecarProse(body, file, "bundle")
    return { prose, examples: harvestExamples(prose) }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

/**
 * Builds a bundle's registry entry, or throws one error listing every
 * failure, each naming the file it is in.
 */
export function buildBundleReference(
    declarations: BundleDeclarations
): BundleReference {
    const { id, entryFile, docs } = declarations
    const failures: string[] = []
    const fail = (file: string, message: string): void => {
        failures.push(file + ": " + message)
    }

    const fieldsByName = new Map(
        declarations.config.map((field) => [field.name, field])
    )

    const config: BundleConfigField[] = []
    for (const field of declarations.config) {
        const what = "CONFIG_SPEC." + field.name
        if (isBlank(field.description))
            fail(entryFile, what + " has no description")
        if (field.default !== undefined) {
            if (isBlank(field.default))
                fail(entryFile, what + " has a blank default")
            else {
                const failure = configValueFailure(field, field.default)
                if (failure) fail(entryFile, what + ".default " + failure)
            }
        }
        config.push({
            name: field.name,
            type: field.type,
            ...(field.values && { values: field.values }),
            ...(field.format !== undefined && { format: field.format }),
            description: field.description?.trim() ?? "",
            ...(field.default !== undefined && { default: field.default }),
        })
    }

    const variants: BundleVariantReference[] = []
    const seenVariants = new Set<string>()
    for (const variant of declarations.variants) {
        const what = 'variant "' + variant.name + '"'
        if (seenVariants.has(variant.name))
            fail(entryFile, "duplicate " + what + " in VARIANTS")
        seenVariants.add(variant.name)
        if (isBlank(variant.description))
            fail(entryFile, what + " has no description")
        const defaultSize = variant.defaultSize ?? "wide"
        const archie = defaultVariantArchie(id, variant.name, defaultSize)
        for (const failure of validateExample({
            archie,
            flavour: "archie",
            section: "intro",
            position: 0,
        }))
            fail(entryFile, what + " default block is invalid: " + failure)
        variants.push({
            name: variant.name,
            description: variant.description?.trim() ?? "",
            defaultSize,
            archie,
        })
    }

    let parsedDocs: ParsedDocs = { prose: { intro: "" }, examples: [] }
    if (docs) {
        try {
            parsedDocs = parseDocs(docs.file, docs.text)
        } catch (error) {
            // The parsers name the file themselves
            failures.push(errorMessage(error))
        }
        parsedDocs.examples.forEach((example, index) => {
            for (const failure of exampleFailures(
                example,
                id,
                seenVariants,
                fieldsByName
            ))
                fail(docs.file, "example #" + (index + 1) + ": " + failure)
        })
    }

    if (failures.length > 0)
        throw new Error(
            'Bespoke bundle "' +
                id +
                '" has ' +
                failures.length +
                " problem(s):\n" +
                failures.map((failure) => "  - " + failure).join("\n")
        )

    return {
        id,
        entryFile,
        ...(docs && { sidecarFile: docs.file }),
        prose: parsedDocs.prose,
        examples: parsedDocs.examples,
        variants,
        config,
    }
}
