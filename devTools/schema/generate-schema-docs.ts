#! /usr/bin/env node

/**
 * Renders the Grapher chart-config JSON Schema into a human-readable markdown
 * reference page for the docs site in `packageDocs/`.
 *
 * Run with: yarn workspace @ourworldindata/grapher buildDocsSchema
 *
 * The script only handles the JSON Schema constructs that the Grapher schema
 * actually uses ($ref/$defs, enum, const, oneOf/anyOf, items, properties,
 * patternProperties, minimum/maximum) – it is not a general-purpose renderer.
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import { parse } from "yaml"
import type { JSONSchema7, JSONSchema7Definition } from "json-schema"
import {
    type SchemaDefinitions,
    REPO_ROOT,
    findLatestSchemaFile,
    resolveRef,
} from "./grapherSchemaSource.js"

interface SectionSpec {
    title: string
    intro?: string
    properties: string[]
}

/** Groups the top-level properties into sections, in the order shown on the page. */
const SECTIONS: readonly SectionSpec[] = [
    {
        title: "Core",
        intro: "Identity of the chart and the schema it validates against.",
        properties: ["$schema", "id", "version", "slug", "isPublished"],
    },
    {
        title: "Text and metadata",
        intro: "Everything that ends up as text in the chart header and footer.",
        properties: [
            "title",
            "subtitle",
            "note",
            "sourceDesc",
            "originUrl",
            "license",
            "internalNotes",
            "variantName",
            "entityType",
            "entityTypePlural",
            "facettingLabelByYVariables",
            "hideAnnotationFieldsInTitle",
            "relatedQuestions",
        ],
    },
    {
        title: "Data and dimensions",
        intro: "Which indicators the chart plots, and how their values are formatted.",
        properties: ["dimensions"],
    },
    {
        title: "Chart types and tabs",
        properties: ["chartTypes", "tab", "hasMapTab"],
    },
    {
        title: "Entity selection",
        intro: "Which entities (usually countries or regions) are shown, and how readers can change that selection.",
        properties: [
            "selectedEntityNames",
            "focusedSeriesNames",
            "includedEntityNames",
            "excludedEntityNames",
            "inapplicableEntityNames",
            "selectedEntityColors",
            "addCountryMode",
            "peerCountryStrategy",
            "matchingEntitiesOnly",
            "missingDataStrategy",
            "zoomToSelection",
        ],
    },
    {
        title: "Time",
        intro: 'Time fields accept a number, or the strings `"earliest"` and `"latest"`.',
        properties: [
            "minTime",
            "maxTime",
            "timelineMinTime",
            "timelineMaxTime",
            "hideTimeline",
        ],
    },
    {
        title: "Axes",
        intro: "`xAxis` and `yAxis` have the same shape.",
        properties: ["xAxis", "yAxis"],
    },
    {
        title: "Colors",
        properties: ["baseColorScheme", "invertColorScheme", "colorScale"],
    },
    {
        title: "Map",
        properties: ["map"],
    },
    {
        title: "Dumbbell charts",
        properties: ["dumbbell"],
    },
    {
        title: "Sorting, stacking and faceting",
        properties: [
            "sortBy",
            "sortOrder",
            "sortColumnSlug",
            "stackMode",
            "selectedFacetStrategy",
        ],
    },
    {
        title: "Display and interaction",
        properties: [
            "logo",
            "hideLogo",
            "hideSeriesLabels",
            "hideRelativeToggle",
            "hideFacetControl",
            "hideTotalValueLabel",
            "hideConnectedScatterLines",
            "hideScatterLabels",
            "showYearLabels",
            "showNoDataArea",
            "compareEndPointsOnly",
            "scatterPointLabelStrategy",
            "comparisonLines",
        ],
    },
]

/** Enums with more values than this are collapsed into a details block. */
const ENUM_INLINE_LIMIT = 12

const outDir = path.join(REPO_ROOT, "packageDocs/docs/schema-reference")

/** Formats a value the way it would appear in a JSON config. */
function formatValue(value: unknown): string {
    return `\`${JSON.stringify(value)}\``
}

/** Turns a property path into a stable heading anchor. */
function toAnchor(propertyPath: string): string {
    return propertyPath
        .toLowerCase()
        .replaceAll("[]", "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

/** Escapes `<` and `>` outside of code spans so markdown doesn't read them as HTML. */
function escapeAngleBrackets(text: string): string {
    return text
        .split(/(`[^`]*`)/)
        .map((part, index) =>
            index % 2 === 1
                ? part
                : part.replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        )
        .join("")
}

const isListItem = (line: string): boolean => /^\s*[-*] /.test(line)

/**
 * Prepares a schema description for markdown: escapes HTML-ish characters and
 * makes sure bullet lists are preceded by a blank line (several descriptions in
 * the schema start a list right after a paragraph, which markdown ignores).
 */
function formatDescription(description: string): string {
    const lines: string[] = []
    for (const line of escapeAngleBrackets(description.trim()).split("\n")) {
        const previous = lines.at(-1)
        if (
            isListItem(line) &&
            previous !== undefined &&
            previous.trim() !== "" &&
            !isListItem(previous)
        )
            lines.push("")
        lines.push(line)
    }
    return lines.join("\n")
}

/** A short, TypeScript-flavoured description of the accepted values. */
function describeType(schema: JSONSchema7, defs: SchemaDefinitions): string {
    const variants = schema.oneOf ?? schema.anyOf
    if (variants)
        return variants
            .map((rawVariant) => {
                const variant = resolveRef(rawVariant, defs)
                return variant.enum
                    ? variant.enum
                          .map((value) => JSON.stringify(value))
                          .join(" | ")
                    : describeType(variant, defs)
            })
            .join(" | ")

    if (Array.isArray(schema.type)) return schema.type.join(" | ")

    if (schema.type === "array") {
        if (!schema.items) return "array"
        const items = resolveRef(schema.items, defs)
        if (items.properties || items.anyOf || items.oneOf) return "object[]"
        const itemType = describeType(items, defs)
        return itemType.includes(" | ") ? `(${itemType})[]` : `${itemType}[]`
    }

    if (schema.type) return schema.type
    return schema.properties ? "object" : "any"
}

/** The one-line metadata shown underneath a property heading. */
function renderMeta(
    schema: JSONSchema7,
    defs: SchemaDefinitions,
    isRequired: boolean
): string {
    const parts = [`Type: \`${describeType(schema, defs)}\``]
    if (schema.const !== undefined)
        parts.push(`Must be ${formatValue(schema.const)}`)
    // A default that just repeats the const value adds nothing.
    if (schema.default !== undefined && schema.default !== schema.const)
        parts.push(`Default: ${formatValue(schema.default)}`)
    if (schema.minimum !== undefined)
        parts.push(`Minimum: ${formatValue(schema.minimum)}`)
    if (schema.maximum !== undefined)
        parts.push(`Maximum: ${formatValue(schema.maximum)}`)
    if (isRequired) parts.push("**Required**")
    return parts.join(" · ")
}

/** Enum values live on the property itself, or on the items of an array. */
function getEnumValues(
    schema: JSONSchema7,
    defs: SchemaDefinitions
): unknown[] | undefined {
    if (schema.enum) return schema.enum
    if (schema.type === "array" && schema.items) {
        const items = resolveRef(schema.items, defs)
        if (items.enum) return items.enum
    }
    return undefined
}

function renderEnum(values: unknown[]): string[] {
    const formatted = values.map(formatValue).join(", ")
    if (values.length <= ENUM_INLINE_LIMIT) return [`Values: ${formatted}`, ""]
    return [
        `??? info "${values.length} allowed values"`,
        "",
        `    ${formatted}`,
        "",
    ]
}

function renderPatternProperties(
    schema: JSONSchema7,
    defs: SchemaDefinitions
): string[] {
    const pattern = Object.values(schema.patternProperties ?? {})[0]
    if (!pattern) return []
    return [
        `Keys can be any string; values are of type \`${describeType(resolveRef(pattern, defs), defs)}\`.`,
        "",
    ]
}

/**
 * Renders a small object shape as a bullet list. Used for the `anyOf` variants
 * of array items, which are too small to deserve their own headings.
 */
function renderVariants(
    variants: JSONSchema7Definition[],
    defs: SchemaDefinitions
): string[] {
    const lines = ["Each entry is one of:", ""]
    for (const rawVariant of variants) {
        const variant = resolveRef(rawVariant, defs)
        if (variant.description)
            lines.push(`**${formatDescription(variant.description)}**`, "")
        for (const [key, rawChild] of Object.entries(
            variant.properties ?? {}
        )) {
            const child = resolveRef(rawChild, defs)
            const required = variant.required?.includes(key)
                ? ", **required**"
                : ""
            const description = child.description
                ? ` – ${formatDescription(child.description)}`
                : ""
            lines.push(
                `- \`${key}\` (\`${describeType(child, defs)}\`${required})${description}`
            )
        }
        lines.push("")
    }
    return lines
}

function renderProperty(
    propertyPath: string,
    rawSchema: JSONSchema7Definition,
    defs: SchemaDefinitions,
    depth: number,
    isRequired: boolean
): string[] {
    const schema = resolveRef(rawSchema, defs)
    // Headings are capped at h4 so the table of contents stays two levels deep;
    // the full property path in the heading keeps the nesting unambiguous.
    const headingLevel = Math.min(3 + depth, 4)

    const lines = [
        `${"#".repeat(headingLevel)} \`${propertyPath}\` { #${toAnchor(propertyPath)} }`,
        "",
        renderMeta(schema, defs, isRequired),
        "",
    ]
    if (schema.description)
        lines.push(formatDescription(schema.description), "")

    const enumValues = getEnumValues(schema, defs)
    if (enumValues) lines.push(...renderEnum(enumValues))
    lines.push(...renderPatternProperties(schema, defs))

    // For arrays of objects we document the shape of a single item.
    const isArray = schema.type === "array"
    const shape =
        isArray && schema.items ? resolveRef(schema.items, defs) : schema
    const childPath = isArray ? `${propertyPath}[]` : propertyPath

    const variants = isArray ? (shape.anyOf ?? shape.oneOf) : undefined
    if (variants) {
        lines.push(...renderVariants(variants, defs))
    } else {
        for (const [key, child] of Object.entries(shape.properties ?? {})) {
            lines.push(
                ...renderProperty(
                    `${childPath}.${key}`,
                    child,
                    defs,
                    depth + 1,
                    shape.required?.includes(key) ?? false
                )
            )
        }
    }

    return lines
}

function renderPage(
    schema: JSONSchema7,
    fileName: string,
    version: string
): string {
    const defs = schema.$defs ?? {}
    const properties = schema.properties ?? {}
    const required = schema.required ?? []
    const jsonUrl = `https://files.ourworldindata.org/schemas/grapher-schema.${version}.json`

    const lines: string[] = [
        `<!-- Generated from ${fileName} by devTools/schema/generate-schema-docs.ts. Do not edit by hand. -->`,
        "",
        "# Chart config schema",
        "",
        `Schema version **${version}** — the canonical JSON Schema is published at [grapher-schema.${version}.json](${jsonUrl}).`,
        "",
        '!!! note "Generated page"',
        "",
        `    This page is generated from \`packages/@ourworldindata/grapher/src/schema/${fileName}\``,
        "    by `yarn workspace @ourworldindata/grapher buildDocsSchema`. Don't edit it by hand.",
        "",
    ]

    if (schema.description)
        lines.push(formatDescription(schema.description), "")

    lines.push(
        `In a persisted config, only ${required.map((key) => `\`${key}\``).join(" and ")} are required; every other field is optional, with defaults listed below where the schema defines one. Unknown properties are rejected.`,
        ""
    )

    const grouped = new Set(SECTIONS.flatMap((section) => section.properties))
    const ungrouped = Object.keys(properties).filter((key) => !grouped.has(key))
    if (ungrouped.length > 0)
        console.warn(
            `Warning: these schema properties aren't assigned to a section and are listed under "Other": ${ungrouped.join(", ")}`
        )

    const sections: SectionSpec[] =
        ungrouped.length > 0
            ? [...SECTIONS, { title: "Other", properties: ungrouped }]
            : [...SECTIONS]

    for (const section of sections) {
        lines.push(`## ${section.title}`, "")
        if (section.intro) lines.push(section.intro, "")
        for (const key of section.properties) {
            const property = properties[key]
            if (!property) {
                console.warn(
                    `Warning: property "${key}" is listed in section "${section.title}" but no longer exists in the schema`
                )
                continue
            }
            lines.push(
                ...renderProperty(
                    key,
                    property,
                    defs,
                    0,
                    required.includes(key)
                )
            )
        }
    }

    // Collapse runs of blank lines and make sure the file ends with exactly one.
    return `${lines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd()}\n`
}

async function main(): Promise<void> {
    const { filePath, fileName, version } = await findLatestSchemaFile()
    const schema = parse(await fs.readFile(filePath, "utf8")) as JSONSchema7

    const markdown = renderPage(schema, fileName, version)
    await fs.mkdir(outDir, { recursive: true })
    const outFile = path.join(outDir, "index.md")
    await fs.writeFile(outFile, markdown)

    console.log(
        `Wrote ${path.relative(REPO_ROOT, outFile)} (${markdown.split("\n").length} lines, ${Math.round(markdown.length / 1024)} KB)`
    )
}

void main()
