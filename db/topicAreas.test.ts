import { describe, expect, it, vi } from "vitest"
import { DbPlainTag } from "@ourworldindata/types"
import {
    getBestBreadcrumbs,
    getBestTagHierarchy,
    getTopicAreaNameForTagNames,
    getTopicAreaNamesByChartId,
    KnexReadonlyTransaction,
    TagHierarchiesByChildName,
} from "./db.js"

const tag = (
    name: string,
    slug: string | null = name
): Pick<DbPlainTag, "id" | "name" | "slug"> => ({
    id: name.length,
    name,
    slug,
})

const hierarchies: TagHierarchiesByChildName = {
    Energy: [[tag("Energy")]],
    Migration: [[tag("Population", null), tag("Migration")]],
    Vaccination: [[tag("Health", null), tag("Disease"), tag("Vaccination")]],
    Orphan: [],
}

describe(getBestTagHierarchy, () => {
    it("uses the first, highest-priority path for each tag", () => {
        const preferred = [tag("Population", null), tag("Migration")]
        expect(
            getBestTagHierarchy(["Migration"], {
                Migration: [
                    preferred,
                    [tag("Health"), tag("Disease"), tag("Migration")],
                ],
            })
        ).toEqual(preferred)
    })

    it.each([
        ["Energy", "Migration", "Vaccination"],
        ["Vaccination", "Migration", "Energy"],
    ])(
        "prefers more clickable topics over a lower leaf id: %s, %s, %s",
        (...names) => {
            expect(getTopicAreaNameForTagNames(names, hierarchies)).toBe(
                "Health"
            )
            expect(
                getBestBreadcrumbs(
                    names.map((name) => tag(name)),
                    hierarchies
                ).map((crumb) => crumb.label)
            ).toEqual(["Disease", "Vaccination"])
        }
    )

    it.each([
        ["Energy", "Migration"],
        ["Migration", "Energy"],
    ])(
        "breaks ties by leaf id regardless of input order: %s, %s",
        (...names) => {
            const tiedHierarchies = {
                Energy: [[{ ...tag("Energy"), id: 20 }]],
                Migration: [
                    [
                        { ...tag("Population", null), id: 30 },
                        { ...tag("Migration"), id: 10 },
                    ],
                ],
            }
            expect(getBestTagHierarchy(names, tiedHierarchies)).toEqual(
                tiedHierarchies.Migration[0]
            )
            expect(getTopicAreaNameForTagNames(names, tiedHierarchies)).toBe(
                "Population"
            )
            expect(
                getBestBreadcrumbs(
                    names.map((name) => tag(name)),
                    tiedHierarchies
                ).map((crumb) => crumb.label)
            ).toEqual(["Migration"])
        }
    )

    it("skips unmapped tags and handles empty input", () => {
        expect(
            getTopicAreaNameForTagNames(
                ["Unknown", "Orphan", "Energy"],
                hierarchies
            )
        ).toBe("Energy")
        expect(
            getTopicAreaNameForTagNames(["Orphan"], hierarchies)
        ).toBeUndefined()
        expect(getTopicAreaNameForTagNames([], hierarchies)).toBeUndefined()
    })

    it("retains an area even when its path has no clickable topics", () => {
        const areas = { Health: [[tag("Health", null)]] }
        expect(getTopicAreaNameForTagNames(["Health"], areas)).toBe("Health")
        expect(getBestBreadcrumbs([tag("Health", null)], areas)).toEqual([])
    })
})

describe(getTopicAreaNamesByChartId, () => {
    it("uses all tags of the first y indicator, then falls back to chart tags", async () => {
        const raw = vi
            .fn()
            .mockResolvedValueOnce([
                [
                    { chartId: 1, variableId: 10, tagName: "Energy" },
                    { chartId: 1, variableId: 10, tagName: "Vaccination" },
                    { chartId: 2, variableId: 20, tagName: "Energy" },
                    { chartId: 2, variableId: 21, tagName: "Vaccination" },
                    { chartId: 3, variableId: 30, tagName: null },
                    { chartId: 3, variableId: 31, tagName: "Energy" },
                ],
            ])
            .mockResolvedValueOnce([
                [
                    { chartId: 2, tagName: "Vaccination" },
                    { chartId: 3, tagName: "Energy" },
                    { chartId: 3, tagName: "Vaccination" },
                    { chartId: 4, tagName: "Unknown" },
                ],
            ])
        const trx = { raw } as unknown as KnexReadonlyTransaction
        expect(await getTopicAreaNamesByChartId(trx, hierarchies)).toEqual({
            1: "Health",
            2: "Energy",
            3: "Health",
        })
    })

    it("does not query when no charts are requested", async () => {
        const raw = vi.fn()
        const trx = { raw } as unknown as KnexReadonlyTransaction
        expect(await getTopicAreaNamesByChartId(trx, hierarchies, [])).toEqual(
            {}
        )
        expect(raw).not.toHaveBeenCalled()
    })
})
