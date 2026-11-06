/**
 * @vitest-environment happy-dom
 */

import { afterAll, assert, beforeAll, describe, expect, test, vi } from "vitest"
import { cleanup, render, fireEvent, screen } from "@testing-library/react"
import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
    GRAPHER_TAB_CONFIG_OPTIONS,
    OwidColumnDef,
} from "@ourworldindata/types"
import { DimensionProperty } from "@ourworldindata/utils"
import { Grapher } from "../core/Grapher.js"
import { GrapherState } from "../core/GrapherState.js"
import { legacyMapGrapher, legacyMapGrapherData } from "./MapChart.sample.js"
import { legacyToOwidTableAndDimensions } from "../core/LegacyToOwidTable.js"

const state = new GrapherState({ ...legacyMapGrapher })
state.inputTable = legacyToOwidTableAndDimensions(
    legacyMapGrapherData,
    legacyMapGrapher.dimensions!,
    legacyMapGrapher.selectedEntityColors
)

beforeAll(() => {
    // Replace IntersectionObserver with a mock that always calls the callback immediately when
    // `observe` is called. This ensures that Grapher is rendering, and doesn't wait for the
    // element to become visible first (which doesn't happen in the test environment).
    const IntersectionObserverMock = class IntersectionObserverMock extends IntersectionObserver {
        constructor(public callback: IntersectionObserverCallback) {
            super(callback)
        }

        override observe(elem: Element): void {
            this.callback(
                [
                    {
                        isIntersecting: true,
                        target: elem,
                        boundingClientRect: {} as DOMRectReadOnly,
                        intersectionRatio: 1,
                        intersectionRect: {} as DOMRectReadOnly,
                        rootBounds: null,
                        time: Date.now(),
                    },
                ],
                this
            )
        }
        override unobserve = vi.fn()
        override disconnect = vi.fn()
    }

    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock)
})

afterAll(() => {
    vi.unstubAllGlobals()
})

test("map tooltip renders iff mouseenter", () => {
    const { container } = render(<Grapher grapherState={state} />)

    expect(screen.queryByRole("tooltip")).toBeFalsy()

    const icelandPath = container.querySelector(
        'path[data-feature-id="Iceland"]'
    )
    assert(icelandPath, "Iceland path should exist")
    fireEvent.pointerEnter(icelandPath, {
        clientX: 50,
        clientY: 50,
    })

    const tooltip = screen.getByRole("tooltip")

    expect(
        tooltip.querySelector(".variable .definition")?.textContent
    ).toContain("% of children under 5")
    expect(tooltip.querySelector(".variable .values")).toHaveTextContent("4%")
})

test("map tooltip renders custom no data label", () => {
    const customState = new GrapherState({
        ...legacyMapGrapher,
        map: {
            ...legacyMapGrapher.map,
            colorScale: {
                customCategoryLabels: {
                    "No data": "Missing Info",
                },
            },
        },
    })
    customState.inputTable = legacyToOwidTableAndDimensions(
        legacyMapGrapherData,
        legacyMapGrapher.dimensions!,
        legacyMapGrapher.selectedEntityColors
    )

    const { container } = render(<Grapher grapherState={customState} />)

    // Hover over a country that has no data (e.g. Argentina)
    const argentinaPath = container.querySelector(
        'path[data-feature-id="Argentina"]'
    )
    assert(argentinaPath, "Argentina path should exist")
    fireEvent.pointerEnter(argentinaPath, {
        clientX: 50,
        clientY: 50,
    })

    const tooltip = screen.getByRole("tooltip")
    expect(tooltip.querySelector(".variable .values")).toHaveTextContent(
        "Missing Info"
    )
})

describe("entity annotation in the tooltip header", () => {
    const makeState = (
        columnDefs: OwidColumnDef[],
        rows: (number | string)[][],
        mapColumnSlug: string,
        time: number
    ): GrapherState => {
        const slugs = columnDefs.map((def) => def.slug)
        return new GrapherState({
            table: new OwidTable(
                [["entityName", "year", ...slugs], ...rows],
                columnDefs
            ),
            dimensions: slugs.map((slug) => ({
                slug,
                property: DimensionProperty.y,
            })),
            chartTypes: [],
            hasMapTab: true,
            tab: GRAPHER_TAB_CONFIG_OPTIONS.map,
            map: { columnSlug: mapColumnSlug, time },
        })
    }

    const hoverAndReadAnnotation = (
        grapherState: GrapherState,
        entityName: string
    ): string | undefined => {
        const { container } = render(<Grapher grapherState={grapherState} />)
        const path = container.querySelector(
            `path[data-feature-id="${entityName}"]`
        )
        assert(path, `${entityName} path should exist`)
        fireEvent.pointerEnter(path, { clientX: 50, clientY: 50 })
        const annotation = screen
            .getByRole("tooltip")
            .querySelector(".frontmatter .title .annotation")
        assert(annotation, "tooltip title should have an annotation element")
        return annotation.textContent || undefined
    }

    test("shows the hovered country's annotation next to its name and none for other countries", () => {
        const defs: OwidColumnDef[] = [
            {
                slug: "population",
                type: ColumnTypeNames.Numeric,
                annotations: [
                    {
                        text: "Estimate",
                        entityNames: ["France"],
                        timeScope: "all",
                    },
                ],
            },
        ]
        const rows = [
            ["France", 2000, 100],
            ["Germany", 2000, 200],
        ]

        expect(
            hoverAndReadAnnotation(
                makeState(defs, rows, "population", 2000),
                "France"
            )
        ).toEqual("Estimate")
        cleanup()
        expect(
            hoverAndReadAnnotation(
                makeState(defs, rows, "population", 2000),
                "Germany"
            )
        ).toBeUndefined()
    })

    describe("when the map joins a historical and a projected column", () => {
        const defs: OwidColumnDef[] = [
            {
                slug: "population",
                type: ColumnTypeNames.Numeric,
                annotations: [
                    {
                        text: "Estimate",
                        entityNames: ["France"],
                        timeScope: "all",
                    },
                ],
            },
            {
                slug: "population_projection",
                type: ColumnTypeNames.Numeric,
                display: { isProjection: true },
                annotations: [
                    {
                        text: "Medium scenario",
                        entityNames: ["France"],
                        timeScope: "all",
                    },
                ],
            },
        ]
        const rows = [
            ["France", 2000, 100, ""],
            ["France", 2010, "", 150],
            ["France", 2020, 120, 130],
        ]
        const annotationAt = (time: number): string | undefined =>
            hoverAndReadAnnotation(
                makeState(defs, rows, "population_projection", time),
                "France"
            )

        test("shows the historical annotation for a historical year", () => {
            expect(annotationAt(2000)).toEqual("Estimate")
        })

        test("shows the projected annotation for a projected year", () => {
            expect(annotationAt(2010)).toEqual("Medium scenario")
        })

        test("shows both annotations for a year with a historical and a projected value", () => {
            expect(annotationAt(2020)).toEqual("Estimate / Medium scenario")
        })
    })
})
