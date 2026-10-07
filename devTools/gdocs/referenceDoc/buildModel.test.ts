/*
 * Registries → library model: one document per item carrying the admin
 * page's material, an index that points at each of them, nothing from the
 * database; plus the Markdown view used by --dry-run.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/referenceDoc/buildModel.test.ts
 */

import { describe, expect, test } from "vitest"
import {
    INDEX_DOC_TITLE,
    PLATFORM_BLOCKS_TITLE,
    buildReferenceLibrary,
    docTitleFor,
    firstUseLine,
    planLibraryDocs,
} from "./buildModel.js"
import { fixtureRegistries } from "./testFixtures.js"
import type { Block, DocRef, ReferenceItemDoc, Run } from "./model.js"
import { runsToPlainText } from "./model.js"
import {
    renderLibraryMarkdown,
    renderLibraryMarkdownAsOne,
} from "./renderMarkdown.js"

const urlFor = (ref: DocRef): string =>
    `https://docs.test/${ref.kind}/${ref.id}`

const library = buildReferenceLibrary(fixtureRegistries, {
    generatedAt: new Date("2026-10-07T12:00:00Z"),
    commitSha: "abc1234",
    urlFor,
})
const item = (kind: string, id: string): ReferenceItemDoc =>
    library.items.find((doc) => doc.kind === kind && doc.id === id)!
const headings = (blocks: Block[], level?: number): string[] =>
    blocks
        .filter((b) => b.type === "heading" && (!level || b.level === level))
        .map((b) => (b.type === "heading" ? b.text : ""))
const paragraphTexts = (blocks: Block[]): string[] =>
    blocks
        .filter((b) => b.type === "paragraph")
        .map((b) => (b.type === "paragraph" ? runsToPlainText(b.runs) : ""))
const allRuns = (blocks: Block[]): Run[] =>
    blocks.flatMap((b) => {
        if (b.type === "paragraph") return b.runs
        if (b.type === "bullets") return b.items.flat()
        if (b.type === "table") return b.rows.flat(2)
        return []
    })
const tables = (blocks: Block[]): string[][][] =>
    blocks
        .filter((b) => b.type === "table")
        .map((b) =>
            b.type === "table"
                ? [b.header, ...b.rows.map((row) => row.map(runsToPlainText))]
                : []
        )

describe(planLibraryDocs, () => {
    test("the index first, then every component, template and guide with its Drive name", () => {
        expect(
            planLibraryDocs(fixtureRegistries).map(
                (doc) => `${doc.kind}:${doc.id} = ${doc.docTitle}`
            )
        ).toEqual([
            "index:index = OWID writing reference — start here",
            "component:callout = {.callout} Callout — OWID writing reference",
            "component:text = {.text} Text — OWID writing reference",
            "component:chart = {.chart} Chart — OWID writing reference",
            "component:cookie-notice = {.cookie-notice} Cookie notice — OWID writing reference",
            "template:article = Article (template) — OWID writing reference",
            "guide:refs = Refs and footnotes (guide) — OWID writing reference",
            "guide:publishing = Publishing a document (guide) — OWID writing reference",
        ])
    })

    test("the plan and the built library agree on every document", () => {
        const planned = planLibraryDocs(fixtureRegistries).slice(1)
        expect(
            library.items.map((doc) => [doc.kind, doc.id, doc.docTitle])
        ).toEqual(planned.map((doc) => [doc.kind, doc.id, doc.docTitle]))
        expect(library.index.docTitle).toBe(INDEX_DOC_TITLE)
    })
})

describe(docTitleFor, () => {
    test("says the id or the kind, so Drive search finds the document", () => {
        expect(docTitleFor("component", { id: "chart", title: "Chart" })).toBe(
            "{.chart} Chart — OWID writing reference"
        )
        expect(docTitleFor("guide", { id: "refs", title: "Refs" })).toBe(
            "Refs (guide) — OWID writing reference"
        )
    })
})

describe("the index", () => {
    const blocks = library.index.blocks

    test("says when and from which commit it was generated, and links to the docs", () => {
        expect(headings(blocks, 1)).toEqual([
            "Writing reference for Google Docs",
        ])
        const texts = paragraphTexts(blocks).join("\n")
        expect(texts).toContain("Generated on 2026-10-07")
        expect(texts).toContain("abc1234")
        expect(texts).toContain("has its own document, linked below")
        expect(allRuns(blocks).map((run) => run.link)).toContain(
            "https://github.com/owid/owid-grapher/blob/master/docs/gdocs-writing-reference.md"
        )
    })

    test("blocks by category in presentation order, one row each, platform blocks as a list", () => {
        expect(headings(blocks, 2)).toEqual([
            "Pick a block by what you want to do",
            "Templates",
            "Guides",
        ])
        expect(headings(blocks, 3)).toEqual([
            "Text & structure",
            "Charts & data",
            PLATFORM_BLOCKS_TITLE,
            "Writing",
            "Publishing",
        ])
        expect(tables(blocks)[0]).toEqual([
            ["Block", "Use it for"],
            ["{.callout}", "A caveat the reader should not miss."],
            // No whenToUse: the first sentence of the intro
            ["{.text} (auto-generated)", "A paragraph of body text."],
        ])
        expect(tables(blocks)[1]).toEqual([
            ["Block", "Use it for"],
            ["{.chart}", "A standalone chart readers can interact with."],
        ])
        const platform = blocks.find((b) => b.type === "bullets")
        expect(
            platform?.type === "bullets" && platform.items.map(runsToPlainText)
        ).toEqual(["{.cookie-notice} — Cookie notice"])
    })

    test("every item cell links to its document; a tag stays monospace", () => {
        const links = allRuns(blocks)
            .filter((run) => run.link?.startsWith("https://docs.test/"))
            .map(
                (run) => `${run.code ? "code " : ""}${run.text} -> ${run.link}`
            )
        expect(links).toEqual([
            "code {.callout} -> https://docs.test/component/callout",
            "code {.text} -> https://docs.test/component/text",
            "code {.chart} -> https://docs.test/component/chart",
            "code {.cookie-notice} -> https://docs.test/component/cookie-notice",
            "Article -> https://docs.test/template/article",
            "Refs and footnotes -> https://docs.test/guide/refs",
            "Publishing a document -> https://docs.test/guide/publishing",
        ])
    })

    test("templates and guides tables carry the one-liners", () => {
        expect(tables(blocks)[2]).toEqual([
            ["Template", "What it is for"],
            ["Article", "Any self-contained narrative piece."],
        ])
        expect(tables(blocks).slice(3)).toEqual([
            [
                ["Guide", "What it covers"],
                [
                    "Refs and footnotes",
                    "Footnotes collected at the end of the page.",
                ],
            ],
            [
                ["Guide", "What it covers"],
                ["Publishing a document", "The steps from draft to live page."],
            ],
        ])
    })
})

describe(firstUseLine, () => {
    const mentions = {
        titleFor: (ref: DocRef): string | undefined =>
            ref.id === "refs" ? "Refs and footnotes" : undefined,
    }

    test("the first bullet of whenToUse, mentions resolved, as plain text", () => {
        expect(
            firstUseLine(
                {
                    intro: "Ignored.",
                    whenToUse:
                        "- **Sources** via `{guide:refs}`, or `{.chart}`.\n- Second bullet.",
                },
                mentions
            )
        ).toBe("Sources via Refs and footnotes, or {.chart}.")
    })

    test("without whenToUse, the first sentence of the intro", () => {
        expect(
            firstUseLine(
                {
                    intro: "A note that stands apart from the text. Use it sparingly, e.g. for caveats.\n\n```archie\n{.callout}\n{}\n```",
                },
                mentions
            )
        ).toBe("A note that stands apart from the text.")
        expect(firstUseLine({ intro: "No full stop" }, mentions)).toBe(
            "No full stop"
        )
    })
})

describe("a component document", () => {
    const chart = item("component", "chart")

    test("owns its document: H1 title, the tag line, the admin's static material, a link back", () => {
        expect(chart.docTitle).toBe("{.chart} Chart — OWID writing reference")
        expect(headings(chart.blocks, 1)).toEqual(["Chart"])
        expect(headings(chart.blocks, 2)).toEqual([
            "Use it for",
            "Reach for something else when",
            "Properties",
            "Limitations",
            "See also",
        ])
        expect(paragraphTexts(chart.blocks)[0]).toBe("ArchieML tag: {.chart}")
        expect(chart.blocks.at(-1)).toEqual({
            type: "paragraph",
            runs: [
                { text: "Back to the index: " },
                {
                    text: INDEX_DOC_TITLE,
                    link: "https://docs.test/index/index",
                },
            ],
        })
    })

    test("props table, example and see-also as on the admin page; see-also entries link", () => {
        const table = chart.blocks.find((b) => b.type === "table")
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
        expect(chart.blocks.find((b) => b.type === "code")).toEqual({
            type: "code",
            text: "{.chart}\nurl: https://ourworldindata.org/grapher/life-expectancy\n{}",
        })
        const seeAlso = chart.blocks.at(-2)
        expect(seeAlso).toEqual({
            type: "bullets",
            items: [
                [
                    {
                        text: "{.callout}",
                        code: true,
                        link: "https://docs.test/component/callout",
                    },
                    { text: " — Callout" },
                ],
                [
                    { text: "Guide: " },
                    {
                        text: "Refs and footnotes",
                        link: "https://docs.test/guide/refs",
                    },
                ],
                [
                    { text: "Template: " },
                    {
                        text: "Article",
                        link: "https://docs.test/template/article",
                    },
                ],
            ],
        })
    })

    test("mentions in the prose link to their documents", () => {
        const links = allRuns(chart.blocks)
            .filter((run) => run.link?.startsWith("https://docs.test/"))
            .map((run) => run.text)
        expect(links).toContain("{.callout}")
        expect(links).toContain("Refs and footnotes")
        expect(links).toContain("Article")
    })

    test("a props table without descriptions drops the effect column, required props first", () => {
        const table = item("component", "callout").blocks.find(
            (b) => b.type === "table"
        )
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

    test("an auto-generated block gets the warning; no example is said so; a platform block says so", () => {
        expect(paragraphTexts(item("component", "text").blocks)).toContain(
            "You don't write this as an ArchieML block. It is auto-generated when the document is parsed, from a plain paragraph."
        )
        expect(paragraphTexts(item("component", "text").blocks)).toContain(
            "This component has no standalone ArchieML example — it only appears nested inside other components."
        )
        expect(
            paragraphTexts(item("component", "cookie-notice").blocks)[1]
        ).toMatch(/^Platform block\./)
    })
})

describe("a template document", () => {
    const article = item("template", "article")

    test("skeleton with repeats and linked chips, authored fields table, computed list, admin-managed note", () => {
        expect(headings(article.blocks, 1)).toEqual(["Article"])
        expect(headings(article.blocks, 2)).toEqual([
            "Use it for",
            "Reach for something else when",
            "The shape of an article",
            "Front matter reference",
            "See also",
        ])
        const shape = article.blocks.findIndex(
            (b) => b.type === "heading" && b.text.startsWith("The shape of")
        )
        const skeleton = article.blocks
            .slice(shape)
            .find((b) => b.type === "bullets")
        expect(
            skeleton?.type === "bullets" && skeleton.items.map(runsToPlainText)
        ).toEqual([
            "Opening — One to three plain paragraphs stating the key message. Blocks: {.text}",
            "Sections (repeated) — Prose with the evidence for it. Blocks: {.heading}, {.text}, {.chart}",
        ])
        expect(
            skeleton?.type === "bullets" &&
                skeleton.items[1]
                    .filter((run) => run.code)
                    .map((run) => run.link)
        ).toEqual([
            "https://docs.test/component/heading",
            "https://docs.test/component/text",
            "https://docs.test/component/chart",
        ])
        const table = article.blocks.find((b) => b.type === "table")
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
        const texts = paragraphTexts(article.blocks)
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
})

describe("a guide document", () => {
    test("H1 title, its sections one level down, see also, link back", () => {
        const refs = item("guide", "refs")
        expect(headings(refs.blocks, 1)).toEqual(["Refs and footnotes"])
        // A guide's `## Notes` heading is kept as the free sections are
        expect(headings(refs.blocks, 2)).toEqual([
            "Inline refs",
            "Notes",
            "See also",
        ])
        expect(paragraphTexts(refs.blocks).at(-1)).toBe(
            `Back to the index: ${INDEX_DOC_TITLE}`
        )
    })
})

describe("nothing from the database", () => {
    test("no exemplar, usage or instance wording anywhere", () => {
        expect(renderLibraryMarkdownAsOne(library)).not.toMatch(
            /us-crime-rates|exemplar|instances/i
        )
    })
})

describe(renderLibraryMarkdown, () => {
    test("one file per document, the index first, each starting with its H1", () => {
        const files = renderLibraryMarkdown(library)
        expect(files.map((file) => file.fileName)).toEqual([
            "index.md",
            "component-callout.md",
            "component-text.md",
            "component-chart.md",
            "component-cookie-notice.md",
            "template-article.md",
            "guide-refs.md",
            "guide-publishing.md",
        ])
        expect(files[0].markdown.split("\n")[0]).toBe(
            "# Writing reference for Google Docs"
        )
        expect(files[3].markdown.split("\n")[0]).toBe("# Chart")
    })

    test("as one stream: documents separated by a blank line, links kept, no inline Markdown outside fences", () => {
        const markdown = renderLibraryMarkdownAsOne(library)
        expect(markdown.match(/^# .*$/gm)).toEqual([
            "# Writing reference for Google Docs",
            "# Callout",
            "# Text",
            "# Chart",
            "# Cookie notice",
            "# Article",
            "# Refs and footnotes",
            "# Publishing a document",
        ])
        expect(markdown).toContain("\n\n# Chart\n")
        expect(markdown).toContain(
            "[{.chart}](https://docs.test/component/chart)"
        )
        const outsideFences = markdown
            .split(/^```$/m)
            .filter((_, index) => index % 2 === 0)
            .join("\n")
        expect(outsideFences).not.toMatch(/`|\*\*/)
    })
})
