import { expect, it, describe } from "vitest"
import {
    DimensionProperty,
    GrapherInterface,
    OwidVariableWithSource,
} from "@ourworldindata/types"
import {
    getAuxiliaryDimensions,
    planIndicatorPanes,
} from "./indicatorPanePlan.js"

const LIFE_EXPECTANCY = 1
const GDP = 2
const POPULATION = 3
const REGION = 4

const scatter = (over: Partial<GrapherInterface> = {}): GrapherInterface => ({
    chartTypes: ["ScatterPlot"],
    dimensions: [
        { property: DimensionProperty.color, variableId: REGION },
        { property: DimensionProperty.y, variableId: LIFE_EXPECTANCY },
        { property: DimensionProperty.x, variableId: GDP },
        { property: DimensionProperty.size, variableId: POPULATION },
    ],
    ...over,
})

const links = new Map([
    [POPULATION, { title: "Population", slug: "population" }],
    [REGION, { title: "World region according to OWID" }],
])

const plan = (
    grapher: GrapherInterface,
    auxiliaryMode: "panes" | "mixed" | "line"
) =>
    planIndicatorPanes(grapher, {
        primaryVariableId: LIFE_EXPECTANCY,
        auxiliaryMode,
        auxiliaryLinks: links,
    })

describe(getAuxiliaryDimensions, () => {
    it("lists a scatter's size then colour, and nothing for other charts", () => {
        expect(
            getAuxiliaryDimensions(scatter()).map((d) => d.variableId)
        ).toEqual([POPULATION, REGION])
        expect(
            getAuxiliaryDimensions(scatter({ chartTypes: ["LineChart"] }))
        ).toEqual([])
    })

    it("skips a size/colour indicator that is also on an axis", () => {
        const g = scatter({
            dimensions: [
                { property: DimensionProperty.y, variableId: LIFE_EXPECTANCY },
                { property: DimensionProperty.x, variableId: GDP },
                { property: DimensionProperty.size, variableId: GDP },
            ],
        })
        expect(getAuxiliaryDimensions(g)).toEqual([])
    })
})

describe(planIndicatorPanes, () => {
    it("panes: y, then x, then size, then colour, each aux pane tagged with its role", () => {
        const p = plan(scatter(), "panes")
        expect(p.additionalPaneVariableIds).toEqual([GDP, POPULATION, REGION])
        expect(p.auxiliaryIndicators).toBeUndefined()
        expect(p.auxiliaryRoleFor(POPULATION)).toBe("size")
        expect(p.auxiliaryRoleFor(REGION)).toBe("color")
        expect(p.auxiliaryRoleFor(GDP)).toBeUndefined()
    })

    it("mixed: a linked indicator goes in the line, an unlinked one gets a pane", () => {
        const p = plan(scatter(), "mixed")
        expect(p.additionalPaneVariableIds).toEqual([GDP, REGION])
        expect(p.auxiliaryIndicators).toEqual([
            { role: "size", title: "Population", slug: "population" },
        ])
    })

    it("line: every size/colour indicator goes in the line", () => {
        const p = plan(scatter(), "line")
        expect(p.additionalPaneVariableIds).toEqual([GDP])
        expect(p.auxiliaryIndicators?.map((a) => a.role)).toEqual([
            "size",
            "color",
        ])
    })

    it("gives a non-scatter chart's x dimension no pane", () => {
        const p = plan(
            {
                chartTypes: ["Marimekko"],
                dimensions: [
                    {
                        property: DimensionProperty.y,
                        variableId: LIFE_EXPECTANCY,
                    },
                    { property: DimensionProperty.x, variableId: POPULATION },
                ],
            },
            "panes"
        )
        expect(p.additionalPaneVariableIds).toEqual([])
    })

    it("treats a blank dimension name as unset", () => {
        const g = scatter({
            dimensions: [
                {
                    property: DimensionProperty.y,
                    variableId: LIFE_EXPECTANCY,
                    display: { name: "  " },
                },
                {
                    property: DimensionProperty.x,
                    variableId: GDP,
                    display: { name: "GDP per capita" },
                },
            ],
        })
        const p = plan(g, "panes")
        expect(p.chartDimensionNameFor(LIFE_EXPECTANCY)).toBeUndefined()
        expect(p.chartDimensionNameFor(GDP)).toBe("GDP per capita")
        const metadata = { name: "Life expectancy" } as OwidVariableWithSource
        expect(p.indicatorTitleOverrideFor(LIFE_EXPECTANCY, metadata)).toBe(
            "Life expectancy"
        )
    })
})
