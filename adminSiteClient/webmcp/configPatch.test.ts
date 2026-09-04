import { describe, expect, it } from "vitest"
import { mergeConfigPatch, validateConfigPatch } from "./configPatch.js"

describe(validateConfigPatch, () => {
    it("accepts known top-level fields", () => {
        const result = validateConfigPatch({
            title: "T",
            yAxis: { min: 0 },
            selectedEntityNames: ["Czechia"],
        })
        expect(result.ok).toBe(true)
    })

    it("refuses non-objects and empty patches", () => {
        expect(validateConfigPatch("title").ok).toBe(false)
        expect(validateConfigPatch(null).ok).toBe(false)
        expect(validateConfigPatch([]).ok).toBe(false)
        expect(validateConfigPatch({}).ok).toBe(false)
    })

    it("refuses the whole patch when any key is denied, naming the reason", () => {
        const result = validateConfigPatch({ title: "T", isPublished: true })
        expect(result).toMatchObject({ ok: false })
        if (!result.ok) {
            expect(result.reason).toContain('"isPublished" cannot be set')
            expect(result.reason).toContain("human decision")
        }
    })

    it("refuses unknown keys and lists the valid ones", () => {
        const result = validateConfigPatch({ titel: "typo" })
        expect(result).toMatchObject({ ok: false })
        if (!result.ok) {
            expect(result.reason).toContain('"titel"')
            expect(result.reason).toContain("title")
            expect(result.reason).not.toContain(", id,")
        }
    })
})

describe(mergeConfigPatch, () => {
    const live = {
        id: 12,
        version: 3,
        slug: "life-expectancy",
        isPublished: true,
        title: "Old",
        yAxis: { min: 0, max: 100 },
        selectedEntityNames: ["World", "Czechia"],
    }

    it("keeps identity fields the grapher merge would strip", () => {
        const merged = mergeConfigPatch(live, { title: "New" })
        expect(merged).toMatchObject({
            id: 12,
            version: 3,
            slug: "life-expectancy",
            isPublished: true,
            title: "New",
        })
    })

    it("merges nested objects and replaces arrays", () => {
        const merged = mergeConfigPatch(live, {
            yAxis: { max: 90 },
            selectedEntityNames: ["Slovakia"],
        })
        expect(merged.yAxis).toEqual({ min: 0, max: 90 })
        expect(merged.selectedEntityNames).toEqual(["Slovakia"])
    })

    it("removes a field set to null and leaves the live config untouched", () => {
        const merged = mergeConfigPatch(live, {
            title: null as unknown as string,
        })
        expect("title" in merged).toBe(false)
        expect(live.title).toBe("Old")
    })
})
