/**
 * @vitest-environment happy-dom
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { Bounds } from "@ourworldindata/utils"
import { ColumnTypeNames, GRAPHER_CHART_TYPES } from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { Grapher } from "../core/Grapher"
import { GrapherState } from "../core/GrapherState"

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
})
