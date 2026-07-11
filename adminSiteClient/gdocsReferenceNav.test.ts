import { expect, it, describe } from "vitest"
import {
    ComponentUsage,
    GdocsReferenceUsage,
    OwidGdocType,
} from "@ourworldindata/types"
import { componentsUsedInTemplate } from "./gdocsReferenceNav.js"

const usageOf = (
    componentId: string,
    byDocType: Partial<ComponentUsage["byDocType"][number]>[]
): ComponentUsage => ({
    componentId,
    docsUsingIt: byDocType.reduce(
        (sum, entry) => sum + (entry.docsUsingIt ?? 0),
        0
    ),
    totalUses: 0,
    byDocType: byDocType.map((entry) => ({
        docType: OwidGdocType.Article,
        docsUsingIt: 0,
        totalDocs: 100,
        totalUses: 0,
        label: "occasional",
        ...entry,
    })),
})

const usage: GdocsReferenceUsage = {
    components: [
        usageOf("text", [
            {
                docType: OwidGdocType.DataInsight,
                docsUsingIt: 400,
                label: "standard",
            },
            { docType: OwidGdocType.Article, docsUsingIt: 900 },
        ]),
        usageOf("chart", [
            {
                docType: OwidGdocType.DataInsight,
                docsUsingIt: 350,
                label: "standard",
            },
        ]),
        usageOf("image", [
            {
                docType: OwidGdocType.DataInsight,
                docsUsingIt: 350,
                label: "common",
            },
        ]),
        // Observed in articles only — an entry for the template with zero
        // docs must not count as "used in it"
        usageOf("aside", [
            { docType: OwidGdocType.Article, docsUsingIt: 120 },
            {
                docType: OwidGdocType.DataInsight,
                docsUsingIt: 0,
                label: "unused",
            },
        ]),
        usageOf("homepage-intro", [
            { docType: OwidGdocType.DataInsight, docsUsingIt: 5 },
        ]),
    ],
    totalDocsByType: { [OwidGdocType.DataInsight]: 800 },
}

const doc = (id: string, system?: boolean) => ({ id, title: id, system })

const components = [
    doc("aside"),
    doc("chart"),
    doc("image"),
    doc("text"),
    doc("homepage-intro", true),
    doc("blockquote"),
]

describe(componentsUsedInTemplate, () => {
    it("keeps only blocks used in the template, most-adopted first", () => {
        const scoped = componentsUsedInTemplate(
            components,
            usage,
            OwidGdocType.DataInsight
        )
        expect(scoped.map(({ doc }) => doc.id)).toEqual([
            "text",
            "chart",
            "image",
        ])
    })

    it("carries the template's own adoption entry for each block", () => {
        const scoped = componentsUsedInTemplate(
            components,
            usage,
            OwidGdocType.DataInsight
        )
        expect(scoped[0].entry).toMatchObject({
            docType: OwidGdocType.DataInsight,
            docsUsingIt: 400,
            label: "standard",
        })
    })

    it("breaks adoption ties alphabetically", () => {
        const scoped = componentsUsedInTemplate(
            components,
            usage,
            OwidGdocType.DataInsight
        )
        // chart and image are both at 350 docs
        expect(scoped.map(({ doc }) => doc.id).slice(1)).toEqual([
            "chart",
            "image",
        ])
    })

    it("scopes to nothing when the usage lookup is unavailable", () => {
        for (const unavailable of [undefined, null]) {
            expect(
                componentsUsedInTemplate(
                    components,
                    unavailable,
                    OwidGdocType.DataInsight
                )
            ).toEqual([])
        }
    })
})
