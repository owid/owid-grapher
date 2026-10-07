/*
 * Registries → document model: the admin page's order and labels, without
 * anything from the database; plus the Markdown view used by --dry-run.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/referenceDoc/buildModel.test.ts
 */

import { describe, expect, test } from "vitest"
import {
    PLATFORM_BLOCKS_TITLE,
    SECTION_TITLES,
    buildReferenceDocument,
    flattenToSingleTab,
} from "./buildModel.js"
import { fixtureRegistries } from "./testFixtures.js"
import type { Block, Run } from "./model.js"
import { runsToPlainText } from "./model.js"
import { renderMarkdown } from "./renderMarkdown.js"

const doc = buildReferenceDocument(fixtureRegistries, {
    generatedAt: new Date("2026-10-07T12:00:00Z"),
    commitSha: "abc1234",
})
const section = (title: string): Block[] =>
    doc.sections.find((s) => s.title === title)!.blocks
const headings = (blocks: Block[], level?: number): string[] =>
    blocks
        .filter((b) => b.type === "heading" && (!level || b.level === level))
        .map((b) => (b.type === "heading" ? b.text : ""))
const paragraphTexts = (blocks: Block[]): string[] =>
    blocks
        .filter((b) => b.type === "paragraph")
        .map((b) => (b.type === "paragraph" ? runsToPlainText(b.runs) : ""))

describe(buildReferenceDocument, () => {
    test("has the four sections in tab order", () => {
        expect(doc.sections.map((s) => s.title)).toEqual([
            SECTION_TITLES.overview,
            SECTION_TITLES.guides,
            SECTION_TITLES.templates,
            SECTION_TITLES.components,
        ])
    })

    test("the overview says when and from which commit it was generated", () => {
        const texts = paragraphTexts(section(SECTION_TITLES.overview))
        expect(texts.join("\n")).toContain("Generated on 2026-10-07")
        expect(texts.join("\n")).toContain("abc1234")
        const links = section(SECTION_TITLES.overview)
            .flatMap((b) => (b.type === "paragraph" ? b.runs : []))
            .map((run: Run) => run.link)
            .filter(Boolean)
        expect(links).toContain(
            "https://github.com/owid/owid-grapher/blob/master/docs/gdocs-writing-reference.md"
        )
    })

    test("components: categories in presentation order, platform blocks last, auto-generated after explicit ones", () => {
        const blocks = section(SECTION_TITLES.components)
        expect(headings(blocks, 1)).toEqual([
            "Text & structure",
            "Charts & data",
            PLATFORM_BLOCKS_TITLE,
        ])
        expect(headings(blocks, 2)).toEqual([
            "Callout",
            "Text",
            "Chart",
            "Cookie notice",
        ])
    })

    test("a component carries the admin's static material: tag, decision box, props table, notes, see also", () => {
        const blocks = section(SECTION_TITLES.components)
        const start = blocks.findIndex(
            (b) => b.type === "heading" && b.text === "Chart"
        )
        const end = blocks.findIndex(
            (b, i) => i > start && b.type === "heading" && b.level === 1
        )
        const chart = blocks.slice(start, end)
        expect(headings(chart, 3)).toEqual([
            "Use it for",
            "Reach for something else when",
            "Properties",
            "Limitations",
            "See also",
        ])
        expect(paragraphTexts(chart)[0]).toBe("ArchieML tag: {.chart}")
        const table = chart.find((b) => b.type === "table")
        expect(table).toEqual({
            type: "table",
            header: ["Prop", "Type", "Req.", "What it does"],
            rows: [
                [
                    [{ text: "url", code: true }],
                    [{ text: "string", code: true }],
                    [{ text: "required" }],
                    [{ text: "The chart to show, as a Grapher URL." }],
                ],
                [
                    [{ text: "caption", code: true }],
                    [{ text: "Span[]", code: true }],
                    [{ text: "optional" }],
                    [
                        {
                            text: "A line under the chart; omitted, none is shown.",
                        },
                    ],
                ],
            ],
        })
        expect(chart.find((b) => b.type === "code")).toEqual({
            type: "code",
            text: "{.chart}\nurl: https://ourworldindata.org/grapher/life-expectancy\n{}",
        })
        const seeAlso = chart.at(-1)
        expect(
            seeAlso?.type === "bullets" && seeAlso.items.map(runsToPlainText)
        ).toEqual([
            "{.callout} — Callout",
            "Guide: Refs and footnotes",
            "Template: Article",
        ])
    })

    test("a props table without descriptions drops the effect column, required props first", () => {
        const blocks = section(SECTION_TITLES.components)
        const callout = blocks.findIndex(
            (b) => b.type === "heading" && b.text === "Callout"
        )
        const table = blocks.slice(callout).find((b) => b.type === "table")
        expect(table?.type === "table" && table.header).toEqual([
            "Prop",
            "Type",
            "Req.",
        ])
        expect(
            table?.type === "table" &&
                table.rows.map((row) => runsToPlainText(row[0]))
        ).toEqual(["text", "title"])
    })

    test("an auto-generated block gets the warning instead of a decision box; no example is said so", () => {
        const texts = paragraphTexts(section(SECTION_TITLES.components))
        expect(texts).toContain(
            "You don't write this as an ArchieML block. It is auto-generated when the document is parsed, from a plain paragraph."
        )
        expect(texts).toContain(
            "This component has no standalone ArchieML example — it only appears nested inside other components."
        )
    })

    test("a template: skeleton with repeats and chips, authored fields table, computed list, admin-managed note", () => {
        const blocks = section(SECTION_TITLES.templates)
        expect(headings(blocks, 1)).toEqual(["Article"])
        expect(headings(blocks, 2)).toEqual([
            "Use it for",
            "Reach for something else when",
            "The shape of an article",
            "Front matter reference",
            "See also",
        ])
        const shape = blocks.findIndex(
            (b) => b.type === "heading" && b.text.startsWith("The shape of")
        )
        const skeleton = blocks.slice(shape).find((b) => b.type === "bullets")
        expect(
            skeleton?.type === "bullets" && skeleton.items.map(runsToPlainText)
        ).toEqual([
            "Opening — One to three plain paragraphs stating the key message. Blocks: {.text}",
            "Sections (repeated) — Prose with the evidence for it. Blocks: {.heading}, {.text}, {.chart}",
        ])
        const table = blocks.find((b) => b.type === "table")
        expect(table?.type === "table" && table.header).toEqual([
            "Key",
            "Type",
            "Description",
        ])
        expect(
            table?.type === "table" &&
                table.rows.map((row) => row.map(runsToPlainText))
        ).toEqual([
            ["title", "string", "The document headline."],
            [
                "authors (required)",
                "string[]",
                "Comma-separated author names; see Refs and footnotes.",
            ],
        ])
        const texts = paragraphTexts(blocks)
        expect(texts).toContain(
            "Computed fields (never written by authors), derived from the content when the document is parsed: toc."
        )
        expect(texts).toContain(
            "Managed in the admin, not in the document: slug, published."
        )
        // The sidecar notes close the front matter section, after the admin-managed line
        expect(texts.indexOf("Keep the opening short.")).toBeGreaterThan(
            texts.findIndex((t) => t.startsWith("Managed in the admin"))
        )
    })

    test("guides: categories in presentation order with their descriptions, then each guide", () => {
        const blocks = section(SECTION_TITLES.guides)
        expect(headings(blocks, 1)).toEqual(["Writing", "Publishing"])
        expect(headings(blocks, 2)).toEqual([
            "Refs and footnotes",
            "Publishing a document",
        ])
        const cards = blocks.find((b) => b.type === "bullets")
        expect(
            cards?.type === "bullets" && cards.items.map(runsToPlainText)
        ).toEqual([
            "Refs and footnotes — Footnotes collected at the end of the page.",
        ])
        // A guide's `## Notes` heading is kept as the free sections are
        expect(headings(blocks, 3)).toEqual([
            "Inline refs",
            "Notes",
            "See also",
        ])
    })

    test("nothing from the database: no exemplar, usage or instance wording", () => {
        const markdown = renderMarkdown(doc)
        expect(markdown).not.toMatch(/us-crime-rates|exemplar|instances/i)
    })
})

describe(flattenToSingleTab, () => {
    test("one section, tabs as H1, every heading one level deeper, capped at 4", () => {
        const flat = flattenToSingleTab(doc)
        expect(flat.sections).toHaveLength(1)
        const blocks = flat.sections[0].blocks
        expect(headings(blocks, 1)).toEqual([
            SECTION_TITLES.overview,
            SECTION_TITLES.guides,
            SECTION_TITLES.templates,
            SECTION_TITLES.components,
        ])
        // The component is H3 now, its prose `## Limitations` H4
        expect(headings(blocks, 3)).toContain("Chart")
        expect(headings(blocks, 4)).toContain("Limitations")
        const levels = blocks
            .filter((b) => b.type === "heading")
            .map((b) => (b.type === "heading" ? b.level : 0))
        expect(Math.max(...levels)).toBe(4)
    })
})

describe(renderMarkdown, () => {
    test("four # sections, and no inline Markdown syntax outside code fences", () => {
        const markdown = renderMarkdown(doc)
        expect(markdown.match(/^# .*$/gm)).toEqual([
            "# Overview",
            "# Guides",
            "# Templates",
            "# Components",
        ])
        const outsideFences = markdown
            .split(/^```$/m)
            .filter((_, index) => index % 2 === 0)
            .join("\n")
        expect(outsideFences).not.toMatch(/`|\*\*/)
    })
})
