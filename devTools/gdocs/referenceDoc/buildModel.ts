/*
 * The three committed registries → the library model: one index document
 * plus one document per component, template and guide.
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
    type SidecarProse,
    type TemplateReference,
    type TemplateField,
} from "@ourworldindata/types"
import {
    type Block,
    type DocRef,
    type HeadingLevel,
    type ReferenceDoc,
    type ReferenceDocKind,
    type ReferenceItemDoc,
    type ReferenceItemKind,
    type ReferenceLibrary,
    type Run,
    type UrlFor,
    INDEX_REF,
    bold,
    clampHeadingLevel,
    code,
    heading,
    paragraph,
    runsToPlainText,
    text,
} from "./model.js"
import {
    type MentionResolver,
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
    /** The Google Doc of each library document, once they exist */
    urlFor: UrlFor
}

export const PLATFORM_BLOCKS_TITLE = "Platform blocks"

export const REFERENCE_DOCS_URL =
    "https://github.com/owid/owid-grapher/blob/master/docs/gdocs-writing-reference.md"

const ADMIN_REFERENCE_URL = "https://admin.owid.io/admin/gdocs-reference"

const DOC_TITLE_SUFFIX = " — OWID writing reference"

export const INDEX_DOC_TITLE = "OWID writing reference — start here"

/** A planned document: what Drive needs to know before any content exists */
export interface PlannedDoc extends DocRef {
    docTitle: string
}

/**
 * The Drive name of a document. Drive search finds documents by name, so a
 * component's name carries its ArchieML tag and the others say their kind.
 */
export function docTitleFor(kind: ReferenceDocKind, item: PlannedItem): string {
    switch (kind) {
        case "component":
            return `{.${item.id}} ${item.title}${DOC_TITLE_SUFFIX}`
        case "template":
            return `${item.title} (template)${DOC_TITLE_SUFFIX}`
        case "guide":
            return `${item.title} (guide)${DOC_TITLE_SUFFIX}`
        case "index":
            return INDEX_DOC_TITLE
    }
}

interface PlannedItem {
    id: string
    title: string
}

/**
 * Every document the library needs, index first — enough for the publisher
 * to find or create the Google Docs before the content (which links between
 * them) is built.
 */
export function planLibraryDocs(registries: ReferenceRegistries): PlannedDoc[] {
    const planned: PlannedDoc[] = [{ ...INDEX_REF, docTitle: INDEX_DOC_TITLE }]
    for (const [kind, items] of itemsByKind(registries))
        for (const item of items)
            planned.push({
                kind,
                id: item.id,
                docTitle: docTitleFor(kind, item),
            })
    return planned
}

export function buildReferenceLibrary(
    registries: ReferenceRegistries,
    options: BuildOptions
): ReferenceLibrary {
    const mentions: MentionResolver = {
        titleFor: makeTitleFor(registries),
        urlFor: options.urlFor,
    }
    const items: ReferenceItemDoc[] = []
    for (const [kind, list] of itemsByKind(registries))
        for (const item of list)
            items.push(itemDoc(kind, item, registries, mentions))
    return {
        index: buildIndex(registries, options, mentions),
        items,
    }
}

/** Items in the order their documents are listed: components, templates, guides */
function itemsByKind(
    registries: ReferenceRegistries
): [ReferenceItemKind, PlannedItem[]][] {
    return [
        ["component", componentsInIndexOrder(registries.components)],
        ["template", sortByTitle(registries.templates)],
        ["guide", guidesInIndexOrder(registries.guides)],
    ]
}

function itemDoc(
    kind: ReferenceItemKind,
    item: PlannedItem,
    registries: ReferenceRegistries,
    mentions: MentionResolver
): ReferenceItemDoc {
    const blocks = itemBlocks(kind, item.id, registries, mentions)
    blocks.push(backToIndex(mentions))
    return {
        kind,
        id: item.id,
        title: item.title,
        docTitle: docTitleFor(kind, item),
        blocks,
    }
}

function itemBlocks(
    kind: ReferenceItemKind,
    id: string,
    registries: ReferenceRegistries,
    mentions: MentionResolver
): Block[] {
    switch (kind) {
        case "component":
            return componentBlocks(
                registries.components.find((c) => c.id === id)!,
                mentions
            )
        case "template":
            return templateBlocks(
                registries.templates.find((t) => t.id === id)!,
                mentions
            )
        case "guide":
            return guideBlocks(
                registries.guides.find((g) => g.id === id)!,
                mentions
            )
    }
}

function backToIndex(mentions: MentionResolver): Block {
    return paragraph(
        text("Back to the index: "),
        linked(text(INDEX_DOC_TITLE), INDEX_REF, mentions)
    )
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
// Index: the one document to attach by default
// -----------------------------------------------------------------------------

function buildIndex(
    registries: ReferenceRegistries,
    options: BuildOptions,
    mentions: MentionResolver
): ReferenceDoc {
    const date = options.generatedAt.toISOString().slice(0, 10)
    const blocks: Block[] = [
        heading(1, "Writing reference for Google Docs"),
        paragraph(
            text(
                "Everything you can use when writing our content in Google Docs: the kinds of document you can create, the building blocks that go in them, and the mechanics that cut across both. Each block, template and guide has its own document, linked below. The guidance is the same as the admin's writing reference, without the live usage data and rendered examples."
            )
        ),
        paragraph(
            text(`Generated on ${date} from owid/owid-grapher commit `),
            code(options.commitSha),
            text(
                ". These documents are rewritten automatically on every change to the repository — edits made in them are overwritten. "
            ),
            { text: "How they are produced", link: REFERENCE_DOCS_URL },
            text(" · "),
            { text: "the live admin reference", link: ADMIN_REFERENCE_URL },
            text(".")
        ),
    ]
    blocks.push(...indexComponents(registries.components, mentions))
    blocks.push(...indexTemplates(registries.templates, mentions))
    blocks.push(...indexGuides(registries.guides, mentions))
    return { docTitle: INDEX_DOC_TITLE, blocks }
}

function indexComponents(
    components: ComponentReference[],
    mentions: MentionResolver
): Block[] {
    const blocks: Block[] = [heading(2, "Pick a block by what you want to do")]
    for (const category of COMPONENT_CATEGORIES) {
        const inCategory = sortComponents(
            components.filter(
                (component) =>
                    component.category === category && !component.system
            )
        )
        if (inCategory.length === 0) continue
        blocks.push(heading(3, category))
        blocks.push({
            type: "table",
            header: ["Block", "Use it for"],
            rows: inCategory.map((component) => [
                componentCell(component, mentions),
                [text(firstUseLine(component.prose, mentions))],
            ]),
        })
    }
    const system = sortComponents(
        components.filter((component) => component.system)
    )
    if (system.length > 0) {
        blocks.push(heading(3, PLATFORM_BLOCKS_TITLE))
        blocks.push(
            paragraph(
                text(
                    "Rendered on pages the team manages (homepage, cookie notice, …) — not part of the authoring vocabulary."
                )
            )
        )
        blocks.push({
            type: "bullets",
            items: system.map((component) => [
                tagLink(component.id, mentions),
                text(` — ${component.title}`),
            ]),
        })
    }
    return blocks
}

function componentCell(
    component: ComponentReference,
    mentions: MentionResolver
): Run[] {
    const cell = [tagLink(component.id, mentions)]
    if (component.autoGenerated) cell.push(text(" (auto-generated)"))
    return cell
}

/** `{.id}` in monospace, linked to the component's document when known */
function tagLink(id: string, mentions: MentionResolver): Run {
    return linked(code(`{.${id}}`), { kind: "component", id }, mentions)
}

function linked(run: Run, ref: DocRef, mentions: MentionResolver): Run {
    const url = mentions.urlFor?.(ref)
    return url ? { ...run, link: url } : run
}

function indexTemplates(
    templates: TemplateReference[],
    mentions: MentionResolver
): Block[] {
    if (templates.length === 0) return []
    return [
        heading(2, "Templates"),
        {
            type: "table",
            header: ["Template", "What it is for"],
            rows: sortByTitle(templates).map((template) => [
                [
                    linked(
                        text(template.title),
                        { kind: "template", id: template.id },
                        mentions
                    ),
                ],
                [text(firstUseLine(template.prose, mentions))],
            ]),
        },
    ]
}

function indexGuides(
    guides: GuideReference[],
    mentions: MentionResolver
): Block[] {
    const blocks: Block[] = []
    for (const category of GUIDE_CATEGORIES) {
        const inCategory = sortByTitle(
            guides.filter((guide) => guide.category === category)
        )
        if (inCategory.length === 0) continue
        if (blocks.length === 0) blocks.push(heading(2, "Guides"))
        blocks.push(heading(3, category))
        blocks.push({
            type: "table",
            header: ["Guide", "What it covers"],
            rows: inCategory.map((guide) => [
                [
                    linked(
                        text(guide.title),
                        { kind: "guide", id: guide.id },
                        mentions
                    ),
                ],
                [text(guide.description)],
            ]),
        })
    }
    return blocks
}

/**
 * The one-liner for an item in the index: the first bullet of its "Use it
 * for" prose, or without one the first sentence of its intro — as plain
 * text, mentions resolved the way the prose renders them.
 */
export function firstUseLine(
    prose: SidecarProse,
    mentions: MentionResolver
): string {
    if (prose.whenToUse) {
        const bullets = markdownToBlocks(prose.whenToUse, {
            baseLevel: 1,
            ...mentions,
        }).find((block) => block.type === "bullets")
        const first = bullets?.items[0]
        if (first) return runsToPlainText(first)
    }
    const intro = markdownToBlocks(prose.intro, {
        baseLevel: 1,
        ...mentions,
    }).find((block) => block.type === "paragraph")
    if (!intro) return ""
    return firstSentence(runsToPlainText(intro.runs))
}

function firstSentence(value: string): string {
    const match = /^.*?[.!?](?=\s|$)/.exec(value)
    return (match ? match[0] : value).trim()
}

// -----------------------------------------------------------------------------
// Guides
// -----------------------------------------------------------------------------

/** Guides in the index's order: by category, then by title */
function guidesInIndexOrder(guides: GuideReference[]): GuideReference[] {
    return GUIDE_CATEGORIES.flatMap((category) =>
        sortByTitle(guides.filter((guide) => guide.category === category))
    )
}

function guideBlocks(
    guide: GuideReference,
    mentions: MentionResolver
): Block[] {
    const level: HeadingLevel = 1
    const blocks: Block[] = [heading(level, guide.title)]
    blocks.push(...prose(guide.prose.intro, level, mentions))
    blocks.push(...prose(guide.prose.notes, level, mentions))
    blocks.push(...seeAlso(guide.related, level, mentions))
    return blocks
}

// -----------------------------------------------------------------------------
// Templates
// -----------------------------------------------------------------------------

function templateBlocks(
    template: TemplateReference,
    mentions: MentionResolver
): Block[] {
    const level: HeadingLevel = 1
    const blocks: Block[] = [heading(level, template.title)]
    blocks.push(...prose(template.prose.intro, level, mentions))
    blocks.push(...decisionBox(template.prose, level, mentions))
    blocks.push(...skeletonBlocks(template, level, mentions))
    blocks.push(...fieldBlocks(template, level, mentions))
    blocks.push(...seeAlso(template.related, level, mentions))
    return blocks
}

function skeletonBlocks(
    template: TemplateReference,
    level: HeadingLevel,
    mentions: MentionResolver
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
                runs.push(...inlineMarkdownToRuns(part.description, mentions))
                if (part.components.length > 0) {
                    runs.push(text(" Blocks: "))
                    part.components.forEach((id, index) => {
                        if (index > 0) runs.push(text(", "))
                        runs.push(tagLink(id, mentions))
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
    mentions: MentionResolver
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
            rows: authored.map((field) => fieldRow(field, mentions)),
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
    blocks.push(...prose(template.prose.notes, sectionLevel, mentions))
    return blocks
}

function fieldRow(field: TemplateField, mentions: MentionResolver): Run[][] {
    const key: Run[] = [code(field.name)]
    if (!field.optional) key.push(text(" (required)"))
    return [
        key,
        [code(field.type)],
        field.description
            ? inlineMarkdownToRuns(field.description, mentions)
            : [],
    ]
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

/** Components in the index's order: by category, platform blocks last */
function componentsInIndexOrder(
    components: ComponentReference[]
): ComponentReference[] {
    const explicit = COMPONENT_CATEGORIES.flatMap((category) =>
        sortComponents(
            components.filter(
                (component) =>
                    component.category === category && !component.system
            )
        )
    )
    const system = sortComponents(
        components.filter((component) => component.system)
    )
    return [...explicit, ...system]
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
    mentions: MentionResolver
): Block[] {
    const level: HeadingLevel = 1
    const blocks: Block[] = [heading(level, component.title)]
    blocks.push(paragraph(text("ArchieML tag: "), code(`{.${component.id}}`)))
    if (component.system)
        blocks.push(
            paragraph(
                bold("Platform block."),
                text(
                    " Rendered on pages the team manages (homepage, cookie notice, …) — not part of the authoring vocabulary."
                )
            )
        )
    if (component.autoGenerated)
        blocks.push(
            paragraph(
                bold("You don't write this as an ArchieML block."),
                text(
                    ` It is auto-generated when the document is parsed, from ${component.autoGenerated}.`
                )
            )
        )
    blocks.push(...prose(component.prose.intro, level, mentions))
    blocks.push(...decisionBox(component.prose, level, mentions))
    blocks.push(...propsBlocks(component, level, mentions))
    blocks.push(...prose(component.prose.notes, level, mentions))
    if (component.examples.length === 0)
        blocks.push(
            paragraph(
                text(
                    "This component has no standalone ArchieML example — it only appears nested inside other components."
                )
            )
        )
    blocks.push(...seeAlso(component.related, level, mentions))
    return blocks
}

/** Prop | Type | Req. | What it does — required props first, as in the admin */
function propsBlocks(
    component: ComponentReference,
    level: HeadingLevel,
    mentions: MentionResolver
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
                            ? inlineMarkdownToRuns(prop.description, mentions)
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
    mentions: MentionResolver
): Block[] {
    if (!markdown) return []
    return markdownToBlocks(markdown, { baseLevel: level, ...mentions })
}

/** "Use it for" / "Reach for something else when", one level under `level` */
function decisionBox(
    sidecarProse: { whenToUse?: string; whenNotToUse?: string },
    level: HeadingLevel,
    mentions: MentionResolver
): Block[] {
    const panelLevel = clampHeadingLevel(level + 1)
    const blocks: Block[] = []
    if (sidecarProse.whenToUse) {
        blocks.push(heading(panelLevel, "Use it for"))
        blocks.push(...prose(sidecarProse.whenToUse, panelLevel, mentions))
    }
    if (sidecarProse.whenNotToUse) {
        blocks.push(heading(panelLevel, "Reach for something else when"))
        blocks.push(...prose(sidecarProse.whenNotToUse, panelLevel, mentions))
    }
    return blocks
}

/** The "See also" chips: components by tag, guides and templates by title, each linked */
function seeAlso(
    related: RelatedRef[] | undefined,
    level: HeadingLevel,
    mentions: MentionResolver
): Block[] {
    if (!related || related.length === 0) return []
    return [
        heading(clampHeadingLevel(level + 1), "See also"),
        {
            type: "bullets",
            items: related.map((ref) => {
                const title = mentions.titleFor(ref) ?? ref.id
                if (ref.kind === "component")
                    return [tagLink(ref.id, mentions), text(` — ${title}`)]
                return [
                    text(`${capitalize(ref.kind)}: `),
                    linked(text(title), ref, mentions),
                ]
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
