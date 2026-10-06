import { expect, it, describe } from "vitest"
import {
    DimensionProperty,
    GrapherInterface,
    OwidChartDimensionInterface,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import {
    findChartParentIndicatorId,
    findLastMapColorScaleEdit,
    makeChartBaseConfig,
    makeRestoredPatchConfig,
    type Log,
} from "./adminChartApi.js"

const log = (
    userName: string,
    createdAt: string,
    colorScale: Record<string, unknown> | undefined
): Log => ({
    userId: 1,
    userName,
    createdAt,
    config: { map: { colorScale } },
})

describe(findLastMapColorScaleEdit, () => {
    it("reports the revision that changed the color scale", () => {
        const edit = findLastMapColorScaleEdit([
            log("Ada", "2026-03-02", { baseColorScheme: "Blues" }),
            log("Grace", "2026-02-11", { baseColorScheme: "Blues" }),
            log("Grace", "2026-02-10", { baseColorScheme: "Reds" }),
        ])

        expect(edit).toEqual({ userName: "Grace", createdAt: "2026-02-11" })
    })

    it("returns nothing when the scale was never touched", () => {
        expect(
            findLastMapColorScaleEdit([
                log("Ada", "2026-03-02", { baseColorScheme: "Blues" }),
                log("Grace", "2026-02-11", { baseColorScheme: "Blues" }),
            ])
        ).toBeUndefined()
    })

    it("returns nothing for a chart with no history to compare", () => {
        expect(findLastMapColorScaleEdit([])).toBeUndefined()
        expect(
            findLastMapColorScaleEdit([log("Ada", "2026-03-02", undefined)])
        ).toBeUndefined()
    })

    it("counts adding a color scale to a chart that had none", () => {
        const edit = findLastMapColorScaleEdit([
            log("Ada", "2026-03-02", { baseColorScheme: "Blues" }),
            log("Ada", "2026-03-01", undefined),
        ])

        expect(edit).toEqual({ userName: "Ada", createdAt: "2026-03-02" })
    })
})

// A chart's base is its indicator's config, applied only with inheritance on,
// with the chart's own ETL layer on top, always. The indicator is the single y
// indicator that the ETL layer and patch name together.
describe(makeChartBaseConfig, () => {
    const indicatorConfig: GrapherInterface = {
        note: "Indicator note",
        title: "Indicator title",
    }
    const etlConfig: GrapherInterface = {
        title: "ETL title",
        hasMapTab: true,
    }

    it("puts the chart's ETL layer above the indicator's config", () => {
        expect(
            makeChartBaseConfig({
                indicatorConfig,
                etlConfig,
                isInheritanceEnabled: true,
            })
        ).toEqual({
            note: "Indicator note",
            title: "ETL title",
            hasMapTab: true,
        })
    })

    it("keeps the ETL layer when inheritance is off", () => {
        expect(
            makeChartBaseConfig({
                indicatorConfig,
                etlConfig,
                isInheritanceEnabled: false,
            })
        ).toEqual({ title: "ETL title", hasMapTab: true })
    })
})

describe(findChartParentIndicatorId, () => {
    it("takes the indicator from the patch", () => {
        expect(
            findChartParentIndicatorId(undefined, {
                dimensions: yDimensionsFor(3),
            })
        ).toBe(3)
    })

    it("takes the indicator from the ETL layer when the patch names none", () => {
        expect(
            findChartParentIndicatorId(
                { dimensions: yDimensionsFor(3) },
                { title: "A title" }
            )
        ).toBe(3)
    })

    it("lets the patch's indicator win over the ETL layer's", () => {
        expect(
            findChartParentIndicatorId(
                { dimensions: yDimensionsFor(3) },
                { dimensions: yDimensionsFor(7) }
            )
        ).toBe(7)
    })

    it("finds none for a chart with two y indicators", () => {
        expect(
            findChartParentIndicatorId(undefined, {
                dimensions: yDimensionsFor(3, 7),
            })
        ).toBeUndefined()
    })
})

describe(makeRestoredPatchConfig, () => {
    it("migrates the revision to the latest schema", () => {
        const restored = makeRestoredPatchConfig(
            {
                $schema:
                    "https://files.ourworldindata.org/schemas/grapher-schema.006.json",
                map: { projection: "Europe" },
            },
            {}
        )

        expect(restored.map).toEqual({ region: "Europe" })
    })

    it("keeps the current id, version, slug and publishing state", () => {
        const restored = makeRestoredPatchConfig(
            {
                $schema: latestGrapherConfigSchema,
                id: 1,
                version: 5,
                slug: "old-slug",
                isPublished: false,
                title: "Old title",
            },
            {
                id: 2,
                version: 9,
                slug: "current-slug",
                isPublished: true,
                title: "Current title",
            }
        )

        expect(restored).toEqual({
            $schema: latestGrapherConfigSchema,
            id: 2,
            version: 9,
            slug: "current-slug",
            isPublished: true,
            title: "Old title",
        })
    })

    it("drops a kept key the current patch doesn't have", () => {
        const restored = makeRestoredPatchConfig(
            {
                $schema: latestGrapherConfigSchema,
                slug: "old-slug",
                isPublished: true,
                title: "Old title",
            },
            { title: "Current title" }
        )

        expect(restored).toEqual({
            $schema: latestGrapherConfigSchema,
            title: "Old title",
        })
    })
})

function yDimensionsFor(
    ...variableIds: number[]
): OwidChartDimensionInterface[] {
    return variableIds.map((variableId) => ({
        property: DimensionProperty.y,
        variableId,
    }))
}
