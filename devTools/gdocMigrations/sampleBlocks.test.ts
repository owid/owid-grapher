import { describe, expect, it } from "vitest"
import { buildDoc, para } from "./testUtils.js"
import { gdocToSourceMappedLines } from "./engine/sourceMap.js"
import { scanScopes } from "./engine/scopeScanner.js"
import {
    collectBlockSamples,
    collectFrontmatterSamples,
    dedupeSamples,
} from "./engine/sampleBlocks.js"
import { buildTestDocLines } from "./engine/testDoc.js"
import { defineGdocMigration } from "./types.js"
import { renameKey } from "../../db/gdocMigrations/helpers.js"

function sampleFrom(specs: Parameters<typeof buildDoc>[0], blockType: string) {
    const lines = gdocToSourceMappedLines(buildDoc(specs))
    return collectBlockSamples("src", lines, scanScopes(lines), blockType)
}

describe(collectBlockSamples, () => {
    it("copies each matching block's ArchieML with its span markup", () => {
        const { samples } = sampleFrom(
            [
                "[+body]",
                "{.prominent-link}",
                para(
                    "url: ",
                    {
                        text: "https://ourworldindata.org/x",
                        link: "https://ourworldindata.org/x",
                    },
                    "" // keeps the paragraph's newline out of the link run
                ),
                "title: Hello",
                "{}",
                "{.chart}",
                "url: https://ourworldindata.org/grapher/y",
                "{}",
                "[]",
            ],
            "prominent-link"
        )
        expect(samples).toHaveLength(1)
        expect(samples[0].lines).toEqual([
            "{.prominent-link}",
            'url: <a href="https://ourworldindata.org/x">https://ourworldindata.org/x</a>',
            "title: Hello",
            "{}",
        ])
        expect(samples[0].shape).toBe("title url[link]")
    })

    it("distinguishes shapes by property set, value form and nesting", () => {
        const { samples } = sampleFrom(
            [
                "[+body]",
                "{.prominent-link}",
                "url: https://a",
                "{}",
                "{.prominent-link}",
                "url: https://b",
                "description:",
                "{}",
                "{.prominent-link}",
                "url: https://c",
                "description: Long",
                ":end",
                "{}",
                "{.prominent-link}",
                "url: https://d",
                "{.image}",
                "filename: x.png",
                "{}",
                "{}",
                "[]",
            ],
            "prominent-link"
        )
        expect(samples.map((sample) => sample.shape)).toEqual([
            "url",
            "description[empty] url",
            "description[multiline] url",
            "url {.image}",
        ])
    })

    it("skips blocks the Docs API cannot faithfully re-create", () => {
        const { samples, skipped } = sampleFrom(
            [
                "[+body]",
                "{.prominent-link}",
                para("url: ", { chip: { uri: "https://a", title: "A" } }),
                "{}",
                "{.prominent-link}",
                { segments: ["url: https://b"], bullet: true },
                "{}",
                "{.prominent-link}",
                "url: https://c",
                "{}",
                "[]",
            ],
            "prominent-link"
        )
        expect(samples).toHaveLength(1)
        expect(skipped["contains-chip"]).toBe(1)
        expect(skipped["non-paragraph-lines"]).toBe(1)
    })
})

describe(collectFrontmatterSamples, () => {
    it("takes top-level lines for the requested keys, case-insensitively", () => {
        const lines = gdocToSourceMappedLines(
            buildDoc([
                "Title: T",
                "Hide-Subscribe-Banner: true",
                "[+body]",
                "hide-subscribe-banner: nope, this one is in the body",
                "[]",
            ])
        )
        const { samples } = collectFrontmatterSamples(
            "src",
            lines,
            scanScopes(lines),
            ["hide-subscribe-banner"]
        )
        expect(samples.map((sample) => sample.lines)).toEqual([
            ["Hide-Subscribe-Banner: true"],
        ])
    })
})

describe("dedupeSamples", () => {
    it("keeps the first of each shape up to the limit", () => {
        const make = (shape: string, id: string) => ({
            shape,
            sourceGdocId: id,
            lines: [],
        })
        const kept = dedupeSamples(
            [make("a", "1"), make("b", "2"), make("a", "3"), make("c", "4")],
            2
        )
        expect(kept.map((sample) => sample.sourceGdocId)).toEqual(["1", "2"])
    })
})

describe(buildTestDocLines, () => {
    it("wraps component samples in a minimal article", () => {
        const migration = defineGdocMigration({
            name: "m",
            mode: "component",
            blockType: "chart",
            discover: "SELECT 1",
            transform: (block) => block,
        })
        const lines = buildTestDocLines(migration, [
            {
                sourceGdocId: "abc",
                shape: "url",
                lines: ["{.chart}", "url: u", "{}"],
            },
        ])
        expect(lines[0]).toBe("title: Migration test doc: m")
        expect(lines).toContain("[+body]")
        expect(lines.at(-1)).toBe("[]")
        expect(lines.join("\n")).toContain("{.chart}\nurl: u\n{}")
        expect(lines.join("\n")).toContain("docs.google.com/document/d/abc")
    })

    it("keeps one frontmatter sample per key and fills in title/type", () => {
        const migration = defineGdocMigration({
            name: "fm",
            mode: "frontmatter",
            discover: "SELECT 1",
            ops: [renameKey("hide-subscribe-banner", "hide-newsletter-banner")],
        })
        const lines = buildTestDocLines(migration, [
            {
                sourceGdocId: "a",
                shape: "x",
                lines: ["Hide-Subscribe-Banner: true"],
            },
            {
                sourceGdocId: "b",
                shape: "y",
                lines: ["hide-subscribe-banner: false"],
            },
        ])
        const bodyIndex = lines.indexOf("[+body]")
        expect(lines.slice(0, bodyIndex)).toEqual([
            "title: Migration test doc: fm",
            "type: article",
            "Hide-Subscribe-Banner: true",
            "",
        ])
    })
})
