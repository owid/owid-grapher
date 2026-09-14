/**
 * @vitest-environment happy-dom
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { Bounds } from "@ourworldindata/utils"
import {
    ColumnTypeNames,
    GRAPHER_CHART_TYPES,
    SortBy,
    SortOrder,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { Grapher, GrapherProgrammaticInterface } from "../core/Grapher"
import { GrapherState } from "../core/GrapherState"

const REGIME_ROWS = [
    { entityName: "France", year: 2000, regime: "Monarchy" },
    { entityName: "France", year: 2001, regime: "Monarchy" },
    { entityName: "France", year: 2002, regime: "Monarchy" },
    { entityName: "France", year: 2005, regime: "Republic" },
    { entityName: "Germany", year: 2000, regime: "Republic" },
    { entityName: "Germany", year: 2003, regime: "Republic" },
    { entityName: "Germany", year: 2004, regime: "Republic" },
    { entityName: "Germany", year: 2005, regime: "Republic" },
]

function makeGrapherState(
    regimeColumnType: ColumnTypeNames,
    config: Partial<GrapherProgrammaticInterface> = {}
): GrapherState {
    const table = new OwidTable(REGIME_ROWS, [
        { slug: "year", type: ColumnTypeNames.Year },
        {
            slug: "regime",
            type: regimeColumnType,
            sort: ["Republic", "Monarchy"],
        },
    ])
    return new GrapherState({
        table,
        ySlugs: "regime",
        chartTypes: [GRAPHER_CHART_TYPES.Swimlane],
        selectedEntityNames: ["France", "Germany"],
        sortBy: SortBy.custom,
        sortOrder: SortOrder.asc,
        bounds: new Bounds(0, 0, 800, 600),
        ...config,
    })
}

beforeAll(() => {
    // Grapher waits for its element to become visible, which never happens in happy-dom
    vi.stubGlobal(
        "IntersectionObserver",
        class extends IntersectionObserver {
            constructor(
                private readonly onIntersect: IntersectionObserverCallback
            ) {
                super(onIntersect)
            }
            override observe(target: Element): void {
                this.onIntersect(
                    [
                        {
                            isIntersecting: true,
                            target,
                        } as IntersectionObserverEntry,
                    ],
                    this
                )
            }
            override unobserve = vi.fn()
            override disconnect = vi.fn()
        }
    )
})

afterAll(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe("SwimlaneChart", () => {
    it("explains why a numeric indicator can't be drawn and draws no lanes", () => {
        const table = new OwidTable(
            [{ entityName: "France", year: 2000, gdp: 1 }],
            [
                { slug: "year", type: ColumnTypeNames.Year },
                { slug: "gdp", type: ColumnTypeNames.Numeric },
            ]
        )
        const { container } = render(
            <Grapher
                grapherState={
                    new GrapherState({
                        table,
                        ySlugs: "gdp",
                        chartTypes: [GRAPHER_CHART_TYPES.Swimlane],
                        selectedEntityNames: ["France"],
                        bounds: new Bounds(0, 0, 800, 600),
                    })
                }
            />
        )

        expect(
            screen.getAllByText("Requires an indicator with categorical values")
        ).not.toHaveLength(0)
        expect(container.querySelector("#lanes")).toBeNull()
    })

    it("shows an ordinal indicator in a numeric legend, in the indicator's order", () => {
        const { container } = render(
            <Grapher grapherState={makeGrapherState(ColumnTypeNames.Ordinal)} />
        )
        const legend = container.querySelector(".numericColorLegend")

        expect(legend).not.toBeNull()
        expect(container.querySelector(".categoricalColorLegend")).toBeNull()
        const labels = within(legend as HTMLElement)
            .getAllByText(/Republic|Monarchy/)
            .map((label) => label.textContent)
        expect(labels).toEqual(["Republic", "Monarchy"])
    })

    it("shows a categorical indicator in a categorical legend", () => {
        const { container } = render(
            <Grapher grapherState={makeGrapherState(ColumnTypeNames.String)} />
        )

        expect(
            container.querySelector(".categoricalColorLegend")
        ).not.toBeNull()
        expect(container.querySelector(".numericColorLegend")).toBeNull()
    })
})
