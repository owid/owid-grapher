import { describe, expect, it } from "vitest"
import {
    describeEtlDrift,
    getOverriddenFields,
    hasEtlDrift,
    makeEtlConfigGitHubUrl,
    makeEtlDrift,
} from "./etlChartSync.js"

describe(makeEtlDrift, () => {
    const inSync = {
        overriddenFields: [],
        slug: "life-expectancy",
        etlSlug: "life-expectancy",
    }

    it("reports a chart nothing was changed on in the admin as in sync", () => {
        const drift = makeEtlDrift(inSync)
        expect(hasEtlDrift(drift)).toBe(false)
        expect(describeEtlDrift(drift)).toEqual([])
    })

    it("lists every kind of admin change on top of ETL", () => {
        const drift = makeEtlDrift({
            overriddenFields: ["title", "subtitle"],
            slug: "renamed-in-admin",
            etlSlug: "life-expectancy",
        })
        expect(hasEtlDrift(drift)).toBe(true)
        expect(describeEtlDrift(drift)).toEqual([
            "Fields overridden in the admin: title, subtitle",
            'Slug "renamed-in-admin" differs from the one ETL proposes ("life-expectancy")',
        ])
    })

    it("doesn't treat a missing ETL slug as a rename", () => {
        expect(hasEtlDrift(makeEtlDrift({ ...inSync, etlSlug: null }))).toBe(
            false
        )
    })
})

describe(getOverriddenFields, () => {
    it("ignores the identity keys every admin patch carries", () => {
        expect(
            getOverriddenFields({
                $schema: "https://example.com/schema.json",
                id: 1,
                slug: "life-expectancy",
                version: 3,
                isPublished: true,
                subtitle: "Changed in the admin",
            })
        ).toEqual(["subtitle"])
    })
})

describe(makeEtlConfigGitHubUrl, () => {
    it("links to the step's config YAML", () => {
        expect(
            makeEtlConfigGitHubUrl(
                "animal_welfare/latest/banning_of_chick_culling#banning_of_chick_culling"
            )
        ).toBe(
            "https://github.com/owid/etl/blob/master/etl/steps/viz/chart/animal_welfare/latest/banning_of_chick_culling.config.yml"
        )
    })

    it("returns nothing for charts without a usable catalog path", () => {
        expect(makeEtlConfigGitHubUrl(null)).toBeUndefined()
        expect(makeEtlConfigGitHubUrl("not-a-path#chart")).toBeUndefined()
    })
})
