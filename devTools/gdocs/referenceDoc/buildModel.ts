/*
 * The three committed registries → the library: one index document plus one
 * document per component, template and guide, each as the Markdown string
 * uploaded to its Google Doc.
 *
 * Mirrors what the admin reference page (adminSiteClient/GdocsReferencePage)
 * renders without the database: section order, labels and the authored prose
 * (passed through, see `proseMarkdown.ts`). Nothing live — no usage counts,
 * instances, exemplars or previews — ever enters it.
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
    type DocRef,
    type ReferenceDoc,
    type ReferenceDocKind,
    type ReferenceItemDoc,
    type ReferenceItemKind,
    type ReferenceLibrary,
    type UrlFor,
    INDEX_REF,
} from "./model.js"
import {
    type MentionResolver,
    type TitleFor,
    codeSpan,
    headingLine,
    inlineProse,
    isFenceLine,
    linkTo,
    rewriteProse,
    tableCell,
} from "./proseMarkdown.js"

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

/** Markdown chunks → one document: chunks separated by a blank line */
function joinChunks(chunks: string[]): string {
    return chunks.filter((chunk) => chunk !== "").join("\n\n") + "\n"
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
    const chunks = itemChunks(kind, item.id, registries, mentions)
    chunks.push(backToIndex(mentions))
    return {
        kind,
        id: item.id,
        title: item.title,
        docTitle: docTitleFor(kind, item),
        markdown: joinChunks(chunks),
    }
}

function itemChunks(
    kind: ReferenceItemKind,
    id: string,
    registries: ReferenceRegistries,
    mentions: MentionResolver
): string[] {
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

function backToIndex(mentions: MentionResolver): string {
    return `Back to the index: ${linkTo(INDEX_DOC_TITLE, mentions.urlFor?.(INDEX_REF))}`
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
    const chunks: string[] = [
        headingLine(1, "Writing reference for Google Docs"),
        "Everything you can use when writing our content in Google Docs: the kinds of document you can create, the building blocks that go in them, and the mechanics that cut across both. Each block, template and guide has its own document, linked below. The guidance is the same as the admin's writing reference, without the live usage data and rendered examples.",
        `Generated on ${date} from owid/owid-grapher commit ${codeSpan(options.commitSha)}. Each document is rewritten whenever its content changes in the repository, which overwrites any edits made in it. ${linkTo("How they are produced", REFERENCE_DOCS_URL)} · ${linkTo("the live admin reference", ADMIN_REFERENCE_URL)}.`,
    ]
    chunks.push(...indexComponents(registries.components, mentions))
    chunks.push(...indexTemplates(registries.templates, mentions))
    chunks.push(...indexGuides(registries.guides, mentions))
    return { docTitle: INDEX_DOC_TITLE, markdown: joinChunks(chunks) }
}

function indexComponents(
    components: ComponentReference[],
    mentions: MentionResolver
): string[] {
    const chunks: string[] = [
        headingLine(2, "Pick a block by what you want to do"),
    ]
    for (const category of COMPONENT_CATEGORIES) {
        const inCategory = sortComponents(
            components.filter(
                (component) =>
                    component.category === category && !component.system
            )
        )
        if (inCategory.length === 0) continue
        chunks.push(headingLine(3, category))
        chunks.push(
            table(
                ["Block", "Use it for"],
                inCategory.map((component) => [
                    componentCell(component, mentions),
                    firstUseLine(component.prose, mentions),
                ])
            )
        )
    }
    const system = sortComponents(
        components.filter((component) => component.system)
    )
    if (system.length > 0) {
        chunks.push(headingLine(3, PLATFORM_BLOCKS_TITLE))
        chunks.push(
            "Rendered on pages the team manages (homepage, cookie notice, …) — not part of the authoring vocabulary."
        )
        chunks.push(
            bullets(
                system.map(
                    (component) =>
                        `${tagLink(component.id, mentions)} — ${component.title}`
                )
            )
        )
    }
    return chunks
}

function componentCell(
    component: ComponentReference,
    mentions: MentionResolver
): string {
    const tag = tagLink(component.id, mentions)
    return component.autoGenerated ? `${tag} (auto-generated)` : tag
}

/** `{.id}` as code, linked to the component's document when known */
function tagLink(id: string, mentions: MentionResolver): string {
    return linkTo(
        codeSpan(`{.${id}}`),
        mentions.urlFor?.({ kind: "component", id })
    )
}

function indexTemplates(
    templates: TemplateReference[],
    mentions: MentionResolver
): string[] {
    if (templates.length === 0) return []
    return [
        headingLine(2, "Templates"),
        table(
            ["Template", "What it is for"],
            sortByTitle(templates).map((template) => [
                linkTo(
                    template.title,
                    mentions.urlFor?.({ kind: "template", id: template.id })
                ),
                firstUseLine(template.prose, mentions),
            ])
        ),
    ]
}

function indexGuides(
    guides: GuideReference[],
    mentions: MentionResolver
): string[] {
    const chunks: string[] = []
    for (const category of GUIDE_CATEGORIES) {
        const inCategory = sortByTitle(
            guides.filter((guide) => guide.category === category)
        )
        if (inCategory.length === 0) continue
        if (chunks.length === 0) chunks.push(headingLine(2, "Guides"))
        chunks.push(headingLine(3, category))
        chunks.push(
            table(
                ["Guide", "What it covers"],
                inCategory.map((guide) => [
                    linkTo(
                        guide.title,
                        mentions.urlFor?.({ kind: "guide", id: guide.id })
                    ),
                    guideSummary(guide, mentions),
                ])
            )
        )
    }
    return chunks
}

/**
 * A guide's line in the index: the first paragraph of its intro — what
 * `description` holds as plain text — kept as Markdown, so its code spans
 * and mentions survive.
 */
function guideSummary(
    guide: GuideReference,
    mentions: MentionResolver
): string {
    const paragraph = firstParagraph(guide.prose.intro)
    return inlineProse(paragraph || guide.description, mentions)
}

/**
 * The one-liner for an item in the index: the first top-level bullet of its
 * "Use it for" prose, or without one the first sentence of its intro's first
 * paragraph — as one line of Markdown, mentions resolved.
 */
export function firstUseLine(
    prose: SidecarProse,
    mentions: MentionResolver
): string {
    const bullet = prose.whenToUse ? firstBullet(prose.whenToUse) : undefined
    if (bullet !== undefined) return inlineProse(bullet, mentions)
    const paragraph = firstParagraph(prose.intro)
    return inlineProse(firstSentence(paragraph), mentions)
}

const TOP_LEVEL_BULLET = /^(?:[-*+]|\d+[.)]) /
const LIST_MARKER = /^(?:[-*+]|\d+[.)]) /

/** The text of the first top-level bullet, its indented continuation lines joined */
function firstBullet(markdown: string): string | undefined {
    const lines = markdown.split("\n")
    let inFence = false
    for (const [index, line] of lines.entries()) {
        if (isFenceLine(line)) inFence = !inFence
        const marker = inFence ? null : TOP_LEVEL_BULLET.exec(line)
        if (!marker) continue
        const parts = [line.slice(marker[0].length)]
        for (const next of lines.slice(index + 1)) {
            const trimmed = next.trim()
            if (trimmed === "" || !/^\s/.test(next)) break
            // A nested list or a fenced example is not part of the one-liner
            if (LIST_MARKER.test(trimmed) || isFenceLine(trimmed)) break
            parts.push(trimmed)
        }
        return parts.join(" ")
    }
    return undefined
}

/** The first run of non-blank lines that is neither a fence nor a heading, on one line */
function firstParagraph(markdown: string): string {
    const paragraphs = markdown.split(/\n\s*\n/)
    let inFence = false
    for (const paragraph of paragraphs) {
        const fenceLines = paragraph.split("\n").filter(isFenceLine).length
        const startsInFence = inFence
        if (fenceLines % 2 === 1) inFence = !inFence
        if (startsInFence || fenceLines > 0) continue
        const text = paragraph.trim()
        if (text === "" || text.startsWith("#")) continue
        return text.replace(/\s*\n\s*/g, " ")
    }
    return ""
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
): string[] {
    const level = 1
    return [
        headingLine(level, guide.title),
        prose(guide.prose.intro, level, mentions),
        prose(guide.prose.notes, level, mentions),
        ...seeAlso(guide.related, level, mentions),
    ]
}

// -----------------------------------------------------------------------------
// Templates
// -----------------------------------------------------------------------------

function templateBlocks(
    template: TemplateReference,
    mentions: MentionResolver
): string[] {
    const level = 1
    return [
        headingLine(level, template.title),
        prose(template.prose.intro, level, mentions),
        ...decisionBox(template.prose, level, mentions),
        ...skeletonBlocks(template, level, mentions),
        ...fieldBlocks(template, level, mentions),
        ...seeAlso(template.related, level, mentions),
    ]
}

function skeletonBlocks(
    template: TemplateReference,
    level: number,
    mentions: MentionResolver
): string[] {
    if (template.skeleton.length === 0) return []
    return [
        headingLine(
            level + 1,
            `The shape of ${indefinite(template.title.toLowerCase())}`
        ),
        bullets(
            template.skeleton.map((part) => {
                let line = `**${part.name}**`
                if (part.repeats) line += " (repeated)"
                line += ` — ${inlineProse(part.description, mentions)}`
                if (part.components.length > 0)
                    line += ` Blocks: ${part.components
                        .map((id) => tagLink(id, mentions))
                        .join(", ")}`
                return line
            })
        ),
    ]
}

/**
 * The front matter keys: authored ones as a table, computed ones as a plain
 * list, the admin-managed properties, then the sidecar's notes.
 */
function fieldBlocks(
    template: TemplateReference,
    level: number,
    mentions: MentionResolver
): string[] {
    const sectionLevel = level + 1
    const authored = template.fields.filter(
        (field) => field.kind === "authored"
    )
    const computed = template.fields.filter(
        (field) => field.kind !== "authored"
    )
    const chunks: string[] = [
        headingLine(sectionLevel, "Front matter reference"),
        `The keys you can set at the top of the document, before ${codeSpan("[+body]")}.`,
    ]
    if (authored.length > 0)
        chunks.push(
            table(
                ["Key", "Type", "Description"],
                authored.map((field) => fieldRow(field, mentions))
            )
        )
    if (computed.length > 0)
        chunks.push(
            `Computed fields (never written by authors), derived from the content when the document is parsed: ${commaSeparatedCode(computed.map((field) => field.name))}.`
        )
    if (template.adminManagedFields.length > 0)
        chunks.push(
            `Managed in the admin, not in the document: ${commaSeparatedCode(template.adminManagedFields)}.`
        )
    // The sidecar's notes close the section, as on the admin page
    chunks.push(prose(template.prose.notes, sectionLevel, mentions))
    return chunks
}

function fieldRow(field: TemplateField, mentions: MentionResolver): string[] {
    const key = field.optional
        ? codeSpan(field.name)
        : `${codeSpan(field.name)} (required)`
    return [
        key,
        codeSpan(field.type),
        field.description ? inlineProse(field.description, mentions) : "",
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
): string[] {
    const level = 1
    const chunks: string[] = [
        headingLine(level, component.title),
        `ArchieML tag: ${codeSpan(`{.${component.id}}`)}`,
    ]
    if (component.system)
        chunks.push(
            "**Platform block.** Rendered on pages the team manages (homepage, cookie notice, …) — not part of the authoring vocabulary."
        )
    if (component.autoGenerated)
        chunks.push(
            `**You don't write this as an ArchieML block.** It is auto-generated when the document is parsed, from ${component.autoGenerated}.`
        )
    chunks.push(prose(component.prose.intro, level, mentions))
    chunks.push(...decisionBox(component.prose, level, mentions))
    chunks.push(...propsBlocks(component, level, mentions))
    chunks.push(prose(component.prose.notes, level, mentions))
    if (component.examples.length === 0)
        chunks.push(
            "This component has no standalone ArchieML example — it only appears nested inside other components."
        )
    chunks.push(...seeAlso(component.related, level, mentions))
    return chunks
}

/** Prop | Type | Req. | What it does — required props first, as in the admin */
function propsBlocks(
    component: ComponentReference,
    level: number,
    mentions: MentionResolver
): string[] {
    if (component.props.length === 0) return []
    const hasDescriptions = component.props.some((prop) => prop.description)
    const ordered = [...component.props].sort(
        (a, b) => Number(a.optional) - Number(b.optional)
    )
    const header = ["Prop", "Type", "Req."]
    if (hasDescriptions) header.push("What it does")
    return [
        headingLine(level + 1, "Properties"),
        table(
            header,
            ordered.map((prop) => {
                const row = [
                    codeSpan(prop.name),
                    codeSpan(prop.type),
                    prop.optional ? "optional" : "required",
                ]
                if (hasDescriptions)
                    row.push(
                        prop.description
                            ? inlineProse(prop.description, mentions)
                            : ""
                    )
                return row
            })
        ),
    ]
}

// -----------------------------------------------------------------------------
// Shared pieces
// -----------------------------------------------------------------------------

/** A prose field of a sidecar, under a heading of `level` ("" when absent) */
function prose(
    markdown: string | undefined,
    level: number,
    mentions: MentionResolver
): string {
    if (!markdown) return ""
    return rewriteProse(markdown, level, mentions).trim()
}

/** "Use it for" / "Reach for something else when", one level under `level` */
function decisionBox(
    sidecarProse: { whenToUse?: string; whenNotToUse?: string },
    level: number,
    mentions: MentionResolver
): string[] {
    const panelLevel = level + 1
    const chunks: string[] = []
    if (sidecarProse.whenToUse) {
        chunks.push(headingLine(panelLevel, "Use it for"))
        chunks.push(prose(sidecarProse.whenToUse, panelLevel, mentions))
    }
    if (sidecarProse.whenNotToUse) {
        chunks.push(headingLine(panelLevel, "Reach for something else when"))
        chunks.push(prose(sidecarProse.whenNotToUse, panelLevel, mentions))
    }
    return chunks
}

/** The "See also" chips: components by tag, guides and templates by title, each linked */
function seeAlso(
    related: RelatedRef[] | undefined,
    level: number,
    mentions: MentionResolver
): string[] {
    if (!related || related.length === 0) return []
    return [
        headingLine(level + 1, "See also"),
        bullets(
            related.map((ref) => {
                const title = mentions.titleFor(ref) ?? ref.id
                if (ref.kind === "component")
                    return `${tagLink(ref.id, mentions)} — ${title}`
                return `${capitalize(ref.kind)}: ${linkTo(title, mentions.urlFor?.(ref))}`
            })
        ),
    ]
}

/** A Markdown table; cells are one-line Markdown */
function table(header: string[], rows: string[][]): string {
    const line = (cells: string[]): string =>
        `| ${cells.map(tableCell).join(" | ")} |`
    return [
        line(header),
        line(header.map(() => "---")),
        ...rows.map(line),
    ].join("\n")
}

function bullets(items: string[]): string {
    return items.map((item) => `- ${item}`).join("\n")
}

function commaSeparatedCode(names: string[]): string {
    return names.map(codeSpan).join(", ")
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
