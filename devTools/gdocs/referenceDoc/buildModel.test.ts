/*
 * Registries → library: one Markdown document per item carrying the admin
 * page's material, an index that points at each of them, nothing from the
 * database; plus the files written by --dry-run.
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
import type { DocRef, ReferenceItemDoc } from "./model.js"
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

/** The text of every heading of exactly `level` */
const headings = (markdown: string, level: number): string[] =>
    [...markdown.matchAll(new RegExp(`^#{${level}} (.*)$`, "gm"))].map(
        (match) => match[1]
    )

/** Every table as rows of raw cell Markdown, the divider row dropped */
const tables = (markdown: string): string[][][] =>
    markdown
        .split("\n\n")
        .filter((chunk) => chunk.startsWith("| "))
        .map((chunk) =>
            chunk
                .trim()
                .split("\n")
                .filter((line) => !line.startsWith("| ---"))
                .map((line) =>
                    line
                        .slice(2, -2)
                        .split(/(?<!\\) \| /)
                        .map((cell) => cell.trim())
                )
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
    const markdown = library.index.markdown

    test("says when and from which commit it was generated, and links to the docs", () => {
        expect(headings(markdown, 1)).toEqual([
            "Writing reference for Google Docs",
        ])
        expect(markdown).toContain(
            "Generated on 2026-10-07 from owid/owid-grapher commit `abc1234`."
        )
        expect(markdown).toContain("has its own document, linked below")
        expect(markdown).toContain(
            "[How they are produced](https://github.com/owid/owid-grapher/blob/master/docs/gdocs-writing-reference.md)"
        )
    })

    test("blocks by category in presentation order, one linked row each, platform blocks as a list", () => {
        expect(headings(markdown, 2)).toEqual([
            "Pick a block by what you want to do",
            "Templates",
            "Guides",
        ])
        expect(headings(markdown, 3)).toEqual([
            "Text & structure",
            "Charts & data",
            PLATFORM_BLOCKS_TITLE,
            "Writing",
            "Publishing",
        ])
        expect(tables(markdown)[0]).toEqual([
            ["Block", "Use it for"],
            [
                "[`{.callout}`](https://docs.test/component/callout)",
                "A caveat the reader should not miss.",
            ],
            // No whenToUse: the first sentence of the intro
            [
                "[`{.text}`](https://docs.test/component/text) (auto-generated)",
                "A paragraph of body text.",
            ],
        ])
        expect(tables(markdown)[1]).toEqual([
            ["Block", "Use it for"],
            [
                "[`{.chart}`](https://docs.test/component/chart)",
                "A standalone chart readers can interact with.",
            ],
        ])
        expect(markdown).toContain(
            "- [`{.cookie-notice}`](https://docs.test/component/cookie-notice) — Cookie notice"
        )
    })

    test("templates and guides tables link each item and carry its one-liner", () => {
        expect(tables(markdown).slice(2)).toEqual([
            [
                ["Template", "What it is for"],
                [
                    "[Article](https://docs.test/template/article)",
                    "Any self-contained narrative piece.",
                ],
            ],
            [
                ["Guide", "What it covers"],
                [
                    "[Refs and footnotes](https://docs.test/guide/refs)",
                    // The intro's first paragraph, its mention kept and linked
                    "Footnotes collected at the end of the page, also from a [`{.chart}`](https://docs.test/component/chart) caption.",
                ],
            ],
            [
                ["Guide", "What it covers"],
                [
                    "[Publishing a document](https://docs.test/guide/publishing)",
                    "The steps from draft to live page.",
                ],
            ],
        ])
    })
})

describe(firstUseLine, () => {
    const mentions = {
        titleFor: (ref: DocRef): string | undefined =>
            ref.id === "refs" ? "Refs and footnotes" : undefined,
    }

    test("the first top-level bullet of whenToUse, continuation lines joined, mentions resolved", () => {
        expect(
            firstUseLine(
                {
                    intro: "Ignored.",
                    whenToUse:
                        "Lead-in.\n\n- **Sources** via `{guide:refs}`,\n  or `{.chart}`.\n- Second bullet.",
                },
                mentions
            )
        ).toBe("**Sources** via Refs and footnotes, or `{.chart}`.")
    })

    test("any list marker counts; nested lists and fences stop the continuation", () => {
        expect(
            firstUseLine(
                {
                    intro: "Ignored.",
                    whenToUse:
                        "1. First,\n   continued.\n   - nested\n2. Second.",
                },
                mentions
            )
        ).toBe("First, continued.")
        expect(
            firstUseLine(
                {
                    intro: "Ignored.",
                    whenToUse: "+ Plus bullet:\n  ```\n  code\n  ```",
                },
                mentions
            )
        ).toBe("Plus bullet:")
    })

    test("without whenToUse, the first sentence of the intro's first paragraph", () => {
        expect(
            firstUseLine(
                {
                    intro: "A note that stands apart\nfrom the text. Use it sparingly, e.g. for caveats.\n\n```archie\n{.callout}\n{}\n```",
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
        expect(headings(chart.markdown, 1)).toEqual(["Chart"])
        expect(headings(chart.markdown, 2)).toEqual([
            "Use it for",
            "Reach for something else when",
            "Properties",
            "Limitations",
            "See also",
        ])
        expect(chart.markdown).toMatch(
            /^# Chart\n\nArchieML tag: `\{\.chart\}`\n/
        )
        expect(chart.markdown).toMatch(
            /\n\nBack to the index: \[OWID writing reference — start here\]\(https:\/\/docs\.test\/index\/index\)\n$/
        )
    })

    test("props table, example and see-also as on the admin page; see-also entries link", () => {
        expect(tables(chart.markdown)).toEqual([
            [
                ["Prop", "Type", "Req.", "What it does"],
                [
                    "`url`",
                    "`string`",
                    "required",
                    "The chart to show, as a Grapher URL.",
                ],
                [
                    "`caption`",
                    "`Span[]`",
                    "optional",
                    "A line under the chart; omitted, none is shown.",
                ],
            ],
        ])
        expect(chart.markdown).toContain(
            "```archie\n{.chart}\nurl: https://ourworldindata.org/grapher/life-expectancy\n{}\n```"
        )
        expect(chart.markdown).toContain(
            [
                "## See also",
                "",
                "- [`{.callout}`](https://docs.test/component/callout) — Callout",
                "- Guide: [Refs and footnotes](https://docs.test/guide/refs)",
                "- Template: [Article](https://docs.test/template/article)",
            ].join("\n")
        )
    })

    test("the sidecar prose passes through, its mentions linked", () => {
        expect(chart.markdown).toContain(
            "A Grapher chart embed. The **default** component for an\ninteractive chart."
        )
        expect(chart.markdown).toContain(
            "- Prefer [`{.callout}`](https://docs.test/component/callout) for a note without a chart.\n- See [Refs and footnotes](https://docs.test/guide/refs) for sources and [Article](https://docs.test/template/article) for the layout."
        )
        expect(chart.markdown).toContain(
            "a link to [the docs](https://example.org/docs)."
        )
    })

    test("a props table without descriptions drops the effect column, required props first", () => {
        expect(tables(item("component", "callout").markdown)).toEqual([
            [
                ["Prop", "Type", "Req."],
                ["`text`", "`EnrichedBlockText[]`", "required"],
                ["`title`", "`string`", "optional"],
            ],
        ])
    })

    test("an auto-generated block gets the warning; no example is said so; a platform block says so", () => {
        const text = item("component", "text").markdown
        expect(text).toContain(
            "**You don't write this as an ArchieML block.** It is auto-generated when the document is parsed, from a plain paragraph."
        )
        expect(text).toContain(
            "This component has no standalone ArchieML example — it only appears nested inside other components."
        )
        expect(item("component", "cookie-notice").markdown).toContain(
            "\n\n**Platform block.** Rendered on pages the team manages"
        )
    })
})

describe("a template document", () => {
    const article = item("template", "article").markdown

    test("skeleton with repeats and linked chips, authored fields table, computed list, admin-managed note", () => {
        expect(headings(article, 1)).toEqual(["Article"])
        expect(headings(article, 2)).toEqual([
            "Use it for",
            "Reach for something else when",
            "The shape of an article",
            "Front matter reference",
            "See also",
        ])
        expect(article).toContain(
            [
                "- **Opening** — One to three plain paragraphs stating the key message. Blocks: [`{.text}`](https://docs.test/component/text)",
                "- **Sections** (repeated) — Prose with the evidence for it. Blocks: [`{.heading}`](https://docs.test/component/heading), [`{.text}`](https://docs.test/component/text), [`{.chart}`](https://docs.test/component/chart)",
            ].join("\n")
        )
        expect(tables(article)).toEqual([
            [
                ["Key", "Type", "Description"],
                ["`title`", "`string`", "The document headline."],
                [
                    "`authors` (required)",
                    "`string[]`",
                    "Comma-separated author names; see [Refs and footnotes](https://docs.test/guide/refs).",
                ],
            ],
        ])
        expect(article).toContain(
            "Computed fields (never written by authors), derived from the content when the document is parsed: `toc`."
        )
        // The sidecar notes close the front matter section, after the admin-managed line
        expect(article).toContain(
            "Managed in the admin, not in the document: `slug`, `published`.\n\nKeep the opening short.\n\n## See also"
        )
    })
})

describe("a guide document", () => {
    test("H1 title, its sections one level down, see also, link back", () => {
        const refs = item("guide", "refs").markdown
        expect(headings(refs, 1)).toEqual(["Refs and footnotes"])
        // A guide's `## Notes` heading is kept as the free sections are
        expect(headings(refs, 2)).toEqual(["Inline refs", "Notes", "See also"])
        expect(refs).toContain("```archie\n{ref}A source.{/ref}\n```")
    })

    test("an ordered list passes through as authored", () => {
        expect(item("guide", "publishing").markdown).toBe(
            [
                "# Publishing a document",
                "",
                "The steps from draft to live page.",
                "",
                "1. Register the doc.",
                "2. Preview it.",
                "",
                "Back to the index: [OWID writing reference — start here](https://docs.test/index/index)",
                "",
            ].join("\n")
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

describe("under --dry-run (no URLs)", () => {
    const dry = buildReferenceLibrary(fixtureRegistries, {
        generatedAt: new Date("2026-10-07T12:00:00Z"),
        commitSha: "abc1234",
        urlFor: () => undefined,
    })

    test("nothing links to a document; mentions keep their code form or title", () => {
        const markdown = renderLibraryMarkdownAsOne(dry)
        expect(markdown).not.toContain("](https://docs")
        expect(markdown).toContain(
            "- Prefer `{.callout}` for a note without a chart.\n- See Refs and footnotes for sources and Article for the layout."
        )
        expect(markdown).toContain(
            "Back to the index: OWID writing reference — start here\n"
        )
    })
})

describe(renderLibraryMarkdown, () => {
    test("one file per document, the index first, each its document's Markdown", () => {
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
        expect(files[0].markdown).toBe(library.index.markdown)
        expect(files[3].markdown).toBe(item("component", "chart").markdown)
    })

    test("as one stream: documents separated by a blank line before their H1", () => {
        const markdown = renderLibraryMarkdownAsOne(library)
        expect(headings(markdown, 1)).toEqual([
            "Writing reference for Google Docs",
            "Callout",
            "Text",
            "Chart",
            "Cookie notice",
            "Article",
            "Refs and footnotes",
            "Publishing a document",
        ])
        expect(markdown).toContain("\n\n# Chart\n")
    })
})
