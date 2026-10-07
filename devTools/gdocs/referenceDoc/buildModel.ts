/*
 * The three committed registries → the document model.
 *
 * Mirrors what the admin reference page (adminSiteClient/GdocsReferencePage)
 * renders without the database: section order, labels and the authored prose.
 * Nothing live — no usage counts, instances, exemplars or previews — ever
 * enters this model. This is the single source for both renderers.
 */

import {
    COMPONENT_CATEGORIES,
    GUIDE_CATEGORIES,
    type ComponentReference,
    type GuideReference,
    type RelatedRef,
    type TemplateReference,
    type TemplateField,
} from "@ourworldindata/types"
import {
    type Block,
    type HeadingLevel,
    type ReferenceDocument,
    type Run,
    type Section,
    bold,
    clampHeadingLevel,
    code,
    heading,
    paragraph,
    text,
} from "./model.js"
import {
    type TitleFor,
    inlineMarkdownToRuns,
    markdownToBlocks,
} from "./markdownToBlocks.js"

export interface ReferenceRegistries {
    components: ComponentReference[]
    templates: TemplateReference[]
    guides: GuideReference[]
}

export interface BuildOptions {
    generatedAt: Date
    /** Short git sha of the commit the registries come from */
    commitSha: string
}

export const SECTION_TITLES = {
    overview: "Overview",
    guides: "Guides",
    templates: "Templates",
    components: "Components",
} as const

export const PLATFORM_BLOCKS_TITLE = "Platform blocks"

export const REFERENCE_DOCS_URL =
    "https://github.com/owid/owid-grapher/blob/master/docs/gdocs-writing-reference.md"

const ADMIN_REFERENCE_URL = "https://admin.owid.io/admin/gdocs-reference"

export function buildReferenceDocument(
    registries: ReferenceRegistries,
    options: BuildOptions
): ReferenceDocument {
    const titleFor = makeTitleFor(registries)
    return {
        sections: [
            buildOverview(registries, options),
            buildGuides(registries.guides, titleFor),
            buildTemplates(registries.templates, titleFor),
            buildComponents(registries.components, titleFor),
        ],
    }
}

/**
 * The same content as one section: each tab becomes an H1 chapter and every
 * heading beneath moves one level down (never past H4).
 */
export function flattenToSingleTab(doc: ReferenceDocument): ReferenceDocument {
    const blocks: Block[] = []
    for (const section of doc.sections) {
        blocks.push(heading(1, section.title))
        for (const block of section.blocks)
            blocks.push(
                block.type === "heading"
                    ? { ...block, level: clampHeadingLevel(block.level + 1) }
                    : block
            )
    }
    return { sections: [{ title: SECTION_TITLES.overview, blocks }] }
}

/** Resolves a mention to the title of the component, guide or template */
export function makeTitleFor(registries: ReferenceRegistries): TitleFor {
    const titles: Record<RelatedRef["kind"], Map<string, string>> = {
        component: new Map(
            registries.components.map((item) => [item.id, item.title])
        ),
        guide: new Map(registries.guides.map((item) => [item.id, item.title])),
        template: new Map(
            registries.templates.map((item) => [item.id, item.title])
        ),
    }
    return (ref) => titles[ref.kind].get(ref.id)
}

// -----------------------------------------------------------------------------
// Overview
// -----------------------------------------------------------------------------

function buildOverview(
    registries: ReferenceRegistries,
    options: BuildOptions
): Section {
    const { components, templates, guides } = registries
    const date = options.generatedAt.toISOString().slice(0, 10)
    return {
        title: SECTION_TITLES.overview,
        blocks: [
            heading(1, "Writing reference for Google Docs"),
            paragraph(
                text(
                    "Everything you can use when writing our content in Google Docs: the kinds of document you can create, the building blocks that go in them, and the mechanics that cut across both. The guidance is the same as the admin's writing reference, without the live usage data and rendered examples."
                )
            ),
            paragraph(
                text(`Generated on ${date} from owid/owid-grapher commit `),
                code(options.commitSha),
                text(
                    ". This document is rewritten automatically on every change to the repository — edits made here are overwritten. "
                ),
                {
                    text: "How it is produced",
                    link: REFERENCE_DOCS_URL,
                },
                text(" · "),
                { text: "the live admin reference", link: ADMIN_REFERENCE_URL },
                text(".")
            ),
            heading(2, "What is where"),
            {
                type: "bullets",
                items: [
                    [
                        bold(SECTION_TITLES.templates),
                        text(
                            ` (${templates.length}) — the kinds of document you can write, what each is for, their canonical structure and front matter keys.`
                        ),
                    ],
                    [
                        bold(SECTION_TITLES.components),
                        text(
                            ` (${components.length}) — every ArchieML block that can go in a document body, grouped by what it does, with when to use it and its properties.`
                        ),
                    ],
                    [
                        bold(SECTION_TITLES.guides),
                        text(
                            ` (${guides.length}) — the mechanics that cut across blocks and document types: footnotes, headings, links, publishing steps.`
                        ),
                    ],
                ],
            },
        ],
    }
}

// -----------------------------------------------------------------------------
// Guides: categories in presentation order, guides by title
// -----------------------------------------------------------------------------

function buildGuides(guides: GuideReference[], titleFor: TitleFor): Section {
    const blocks: Block[] = []
    for (const category of GUIDE_CATEGORIES) {
        const inCategory = sortByTitle(
            guides.filter((guide) => guide.category === category)
        )
        if (inCategory.length === 0) continue
        blocks.push(heading(1, category))
        // The card grid of the admin overview: each guide's one-line description
        blocks.push({
            type: "bullets",
            items: inCategory.map((guide) => [
                bold(guide.title),
                text(` — ${guide.description}`),
            ]),
        })
        for (const guide of inCategory)
            blocks.push(...guideBlocks(guide, titleFor))
    }
    return { title: SECTION_TITLES.guides, blocks }
}

function guideBlocks(guide: GuideReference, titleFor: TitleFor): Block[] {
    const level: HeadingLevel = 2
    const blocks: Block[] = [heading(level, guide.title)]
    blocks.push(...prose(guide.prose.intro, level, titleFor))
    blocks.push(...prose(guide.prose.notes, level, titleFor))
    blocks.push(...seeAlso(guide.related, level, titleFor))
    return blocks
}

// -----------------------------------------------------------------------------
// Templates: one chapter per document type, by title
// -----------------------------------------------------------------------------

function buildTemplates(
    templates: TemplateReference[],
    titleFor: TitleFor
): Section {
    return {
        title: SECTION_TITLES.templates,
        blocks: sortByTitle(templates).flatMap((template) =>
            templateBlocks(template, titleFor)
        ),
    }
}

function templateBlocks(
    template: TemplateReference,
    titleFor: TitleFor
): Block[] {
    const level: HeadingLevel = 1
    const blocks: Block[] = [heading(level, template.title)]
    blocks.push(...prose(template.prose.intro, level, titleFor))
    blocks.push(...decisionBox(template.prose, level, titleFor))
    blocks.push(...skeletonBlocks(template, level, titleFor))
    blocks.push(...fieldBlocks(template, level, titleFor))
    blocks.push(...seeAlso(template.related, level, titleFor))
    return blocks
}

function skeletonBlocks(
    template: TemplateReference,
    level: HeadingLevel,
    titleFor: TitleFor
): Block[] {
    if (template.skeleton.length === 0) return []
    return [
        heading(
            clampHeadingLevel(level + 1),
            `The shape of ${indefinite(template.title.toLowerCase())}`
        ),
        {
            type: "bullets",
            items: template.skeleton.map((part) => {
                const runs: Run[] = [bold(part.name)]
                if (part.repeats) runs.push(text(" (repeated)"))
                runs.push(text(" — "))
                runs.push(...inlineMarkdownToRuns(part.description, titleFor))
                if (part.components.length > 0) {
                    runs.push(text(" Blocks: "))
                    part.components.forEach((id, index) => {
                        if (index > 0) runs.push(text(", "))
                        runs.push(code(`{.${id}}`))
                    })
                }
                return runs
            }),
        },
    ]
}

/**
 * The front matter keys: authored ones as a table, computed ones as a plain
 * list, the admin-managed properties, then the sidecar's notes.
 */
function fieldBlocks(
    template: TemplateReference,
    level: HeadingLevel,
    titleFor: TitleFor
): Block[] {
    const sectionLevel = clampHeadingLevel(level + 1)
    const authored = template.fields.filter(
        (field) => field.kind === "authored"
    )
    const computed = template.fields.filter(
        (field) => field.kind !== "authored"
    )
    const blocks: Block[] = [
        heading(sectionLevel, "Front matter reference"),
        paragraph(
            text("The keys you can set at the top of the document, before "),
            code("[+body]"),
            text(".")
        ),
    ]
    if (authored.length > 0)
        blocks.push({
            type: "table",
            header: ["Key", "Type", "Description"],
            rows: authored.map((field) => fieldRow(field, titleFor)),
        })
    if (computed.length > 0)
        blocks.push(
            paragraph(
                text(
                    "Computed fields (never written by authors), derived from the content when the document is parsed: "
                ),
                ...commaSeparatedCode(computed.map((field) => field.name)),
                text(".")
            )
        )
    if (template.adminManagedFields.length > 0)
        blocks.push(
            paragraph(
                text("Managed in the admin, not in the document: "),
                ...commaSeparatedCode(template.adminManagedFields),
                text(".")
            )
        )
    // The sidecar's notes close the section, as on the admin page
    blocks.push(...prose(template.prose.notes, sectionLevel, titleFor))
    return blocks
}

function fieldRow(field: TemplateField, titleFor: TitleFor): Run[][] {
    const key: Run[] = [code(field.name)]
    if (!field.optional) key.push(text(" (required)"))
    return [
        key,
        [code(field.type)],
        field.description
            ? inlineMarkdownToRuns(field.description, titleFor)
            : [],
    ]
}

// -----------------------------------------------------------------------------
// Components: categories in presentation order, platform blocks last
// -----------------------------------------------------------------------------

function buildComponents(
    components: ComponentReference[],
    titleFor: TitleFor
): Section {
    const blocks: Block[] = []
    for (const category of COMPONENT_CATEGORIES) {
        const inCategory = sortComponents(
            components.filter(
                (component) =>
                    component.category === category && !component.system
            )
        )
        if (inCategory.length === 0) continue
        blocks.push(heading(1, category))
        for (const component of inCategory)
            blocks.push(...componentBlocks(component, titleFor))
    }
    const system = sortComponents(
        components.filter((component) => component.system)
    )
    if (system.length > 0) {
        blocks.push(heading(1, PLATFORM_BLOCKS_TITLE))
        blocks.push(
            paragraph(
                text(
                    "Rendered on pages the team manages (homepage, cookie notice, …) — not part of the authoring vocabulary."
                )
            )
        )
        for (const component of system)
            blocks.push(...componentBlocks(component, titleFor))
    }
    return { title: SECTION_TITLES.components, blocks }
}

/** By title, with the auto-generated blocks after the explicit ones */
export function sortComponents(
    components: ComponentReference[]
): ComponentReference[] {
    return [...components].sort(
        (a, b) =>
            Number(!!a.autoGenerated) - Number(!!b.autoGenerated) ||
            a.title.localeCompare(b.title)
    )
}

function componentBlocks(
    component: ComponentReference,
    titleFor: TitleFor
): Block[] {
    const level: HeadingLevel = 2
    const blocks: Block[] = [heading(level, component.title)]
    blocks.push(paragraph(text("ArchieML tag: "), code(`{.${component.id}}`)))
    if (component.autoGenerated)
        blocks.push(
            paragraph(
                bold("You don't write this as an ArchieML block."),
                text(
                    ` It is auto-generated when the document is parsed, from ${component.autoGenerated}.`
                )
            )
        )
    blocks.push(...prose(component.prose.intro, level, titleFor))
    blocks.push(...decisionBox(component.prose, level, titleFor))
    blocks.push(...propsBlocks(component, level, titleFor))
    blocks.push(...prose(component.prose.notes, level, titleFor))
    if (component.examples.length === 0)
        blocks.push(
            paragraph(
                text(
                    "This component has no standalone ArchieML example — it only appears nested inside other components."
                )
            )
        )
    blocks.push(...seeAlso(component.related, level, titleFor))
    return blocks
}

/** Prop | Type | Req. | What it does — required props first, as in the admin */
function propsBlocks(
    component: ComponentReference,
    level: HeadingLevel,
    titleFor: TitleFor
): Block[] {
    if (component.props.length === 0) return []
    const hasDescriptions = component.props.some((prop) => prop.description)
    const ordered = [...component.props].sort(
        (a, b) => Number(a.optional) - Number(b.optional)
    )
    const header = ["Prop", "Type", "Req."]
    if (hasDescriptions) header.push("What it does")
    return [
        heading(clampHeadingLevel(level + 1), "Properties"),
        {
            type: "table",
            header,
            rows: ordered.map((prop) => {
                const row: Run[][] = [
                    [code(prop.name)],
                    [code(prop.type)],
                    [text(prop.optional ? "optional" : "required")],
                ]
                if (hasDescriptions)
                    row.push(
                        prop.description
                            ? inlineMarkdownToRuns(prop.description, titleFor)
                            : []
                    )
                return row
            }),
        },
    ]
}

// -----------------------------------------------------------------------------
// Shared pieces
// -----------------------------------------------------------------------------

/** A prose field of a sidecar, under a heading of `level` */
function prose(
    markdown: string | undefined,
    level: HeadingLevel,
    titleFor: TitleFor
): Block[] {
    if (!markdown) return []
    return markdownToBlocks(markdown, { baseLevel: level, titleFor })
}

/** "Use it for" / "Reach for something else when", one level under `level` */
function decisionBox(
    sidecarProse: { whenToUse?: string; whenNotToUse?: string },
    level: HeadingLevel,
    titleFor: TitleFor
): Block[] {
    const panelLevel = clampHeadingLevel(level + 1)
    const blocks: Block[] = []
    if (sidecarProse.whenToUse) {
        blocks.push(heading(panelLevel, "Use it for"))
        blocks.push(...prose(sidecarProse.whenToUse, panelLevel, titleFor))
    }
    if (sidecarProse.whenNotToUse) {
        blocks.push(heading(panelLevel, "Reach for something else when"))
        blocks.push(...prose(sidecarProse.whenNotToUse, panelLevel, titleFor))
    }
    return blocks
}

/** The "See also" chips: components by tag, guides and templates by title */
function seeAlso(
    related: RelatedRef[] | undefined,
    level: HeadingLevel,
    titleFor: TitleFor
): Block[] {
    if (!related || related.length === 0) return []
    return [
        heading(clampHeadingLevel(level + 1), "See also"),
        {
            type: "bullets",
            items: related.map((ref) => {
                const title = titleFor(ref) ?? ref.id
                if (ref.kind === "component")
                    return [code(`{.${ref.id}}`), text(` — ${title}`)]
                return [text(`${capitalize(ref.kind)}: ${title}`)]
            }),
        },
    ]
}

function commaSeparatedCode(names: string[]): Run[] {
    return names.flatMap((name, index) =>
        index > 0 ? [text(", "), code(name)] : [code(name)]
    )
}

function sortByTitle<T extends { title: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.title.localeCompare(b.title))
}

function indefinite(noun: string): string {
    return (/^[aeiou]/.test(noun) ? "an " : "a ") + noun
}

function capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1)
}
