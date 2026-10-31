import * as fs from "fs"
import * as path from "path"
import { expect, it, describe } from "vitest"

import { DataPageDataV2 } from "@ourworldindata/types"
import { FIELD_ATTRIBUTE } from "./commentAnchors.js"
import { chartCommentFields, indicatorCommentFields } from "./commentFields.js"

/**
 * Every metadata value a data page can show, so indicatorCommentFields returns
 * its full set - fields with no value are dropped, and would slip past below.
 */
const FULLY_POPULATED_DATAPAGE = {
    status: "published",
    title: { title: "Indicator title" },
    titleVariant: "a variant",
    attributionShort: "Producer",
    attributions: ["Producer (2026)"],
    descriptionShort: "a short description",
    descriptionFromProducer: "what the producer says",
    descriptionKey: "what you should know",
    descriptionProcessing: "how we processed it",
    dateRange: "1990-2020",
    lastUpdated: "2026-01-01",
    nextUpdate: "2027-01-01",
    unit: "%",
    unitConversionFactor: 100,
    relatedResearch: [],
    allCharts: [],
    origins: [],
    source: undefined,
    chartConfig: {},
    relatedChartsByCoview: [],
} satisfies DataPageDataV2

/** Every data-comment-field="..." marker anywhere in the rendering code */
function markersInRenderingCode(): Set<string> {
    // Walked from this file rather than the working directory, so it doesn't
    // matter where the tests are run from.
    const roots = [
        path.join(import.meta.dirname, ".."),
        path.join(import.meta.dirname, "..", "..", "packages"),
    ]
    const markers = new Set<string>()
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                if (entry.name === "node_modules" || entry.name === "dist")
                    continue
                walk(full)
            } else if (entry.name.endsWith(".tsx")) {
                const source = fs.readFileSync(full, "utf8")
                for (const match of source.matchAll(
                    new RegExp(`${FIELD_ATTRIBUTE}="([^"]+)"`, "g")
                )) {
                    markers.add(match[1])
                }
            }
        }
    }
    for (const root of roots) walk(root)
    return markers
}

describe("commentable fields are all locatable", () => {
    // A field the overlay offers but cannot find gets no bubble, and nothing
    // says so - it just looks as though nobody can comment on it. Marking a
    // field is a separate edit in a separate component, which is exactly the
    // kind of pair that drifts, so assert it rather than trusting it.
    it("every indicator metadata field is marked where it is rendered", () => {
        const markers = markersInRenderingCode()
        const unmarked = indicatorCommentFields(FULLY_POPULATED_DATAPAGE)
            .map((field) => field.key)
            .filter((key) => !markers.has(key))
        expect(unmarked).toEqual([])
    })

    it("chart-level fields are found through grapher instead, not by marker", () => {
        for (const field of chartCommentFields()) {
            expect(field.grapherPart).toBeDefined()
        }
    })

    it("no field carries its value, which would mean matching text on the page", () => {
        const fields = [
            ...chartCommentFields(),
            ...indicatorCommentFields(FULLY_POPULATED_DATAPAGE),
        ]
        for (const field of fields) {
            expect(field).not.toHaveProperty("value")
        }
    })
})
