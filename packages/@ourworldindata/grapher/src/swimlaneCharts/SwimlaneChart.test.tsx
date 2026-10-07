/**
 * @vitest-environment happy-dom
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react"
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

function findLane(container: HTMLElement, entityName: string): Element {
    const lane = container.querySelector(`#lanes [id="${entityName}"]`)
    if (!lane) throw new Error(`No lane for ${entityName}`)
    return lane
}

/** Rects and paths drawn for a lane's segments, in time order */
function findSegmentShapes(lane: Element): Element[] {
    return Array.from(lane.querySelectorAll("rect, path"))
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

beforeAll(() => {
    // happy-dom's SVGPoint can't transform, so map client coordinates onto the SVG unchanged
    vi.spyOn(SVGSVGElement.prototype, "createSVGPoint").mockImplementation(
        () =>
            ({
                x: 0,
                y: 0,
                matrixTransform(): DOMPoint {
                    return this as DOMPoint
                },
            }) as unknown as DOMPoint
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

    it("tapers a segment the timeline window crops and labels it with the full run", () => {
        const { container } = render(
            <Grapher
                grapherState={makeGrapherState(ColumnTypeNames.String, {
                    minTime: 2001,
                    maxTime: 2005,
                })}
            />
        )
        const france = findLane(container, "France")

        expect(
            findSegmentShapes(france).map((shape) =>
                shape.tagName.toLowerCase()
            )
        ).toEqual(["path", "rect", "rect"])
        expect(
            within(france as HTMLElement).getByText("2000–2002")
        ).toBeTruthy()
    })

    describe("tooltip", () => {
        function hoverSegment(
            container: HTMLElement,
            {
                laneIndex,
                segmentIndex,
            }: { laneIndex: number; segmentIndex: number }
        ): void {
            const hitArea = container.querySelector(
                '#lanes ~ g > rect[fill-opacity="0"]'
            )
            if (!hitArea) throw new Error("No hit area")
            const plotTop = Number(hitArea.getAttribute("y"))
            const plotHeight = Number(hitArea.getAttribute("height"))
            const plotMiddle = plotTop + plotHeight / 2

            const lane = findLane(container, ["France", "Germany"][laneIndex])
            const segment = findSegmentShapes(lane)[segmentIndex]
            const segmentX =
                segment.getAttribute("x") ??
                segment.getAttribute("d")?.match(/^M ([\d.]+),/)?.[1]

            fireEvent.mouseMove(hitArea, {
                clientX: Number(segmentX) + 0.5,
                clientY: laneIndex === 0 ? plotMiddle - 1 : plotMiddle + 1,
            })
        }

        it("names the entity, the whole run and its duration for a category the window crops", () => {
            const { container } = render(
                <Grapher
                    grapherState={makeGrapherState(ColumnTypeNames.String, {
                        minTime: 2001,
                        maxTime: 2005,
                    })}
                />
            )

            hoverSegment(container, { laneIndex: 0, segmentIndex: 0 })

            const tooltip = within(screen.getByRole("tooltip"))
            expect(tooltip.getByText("France")).toBeTruthy()
            expect(tooltip.getByText("2000–2002")).toBeTruthy()
            expect(tooltip.getByText("Monarchy")).toBeTruthy()
            expect(tooltip.getByText("2 years")).toBeTruthy()
        })

        it("says there is no data for a missing segment, without a duration", () => {
            const { container } = render(
                <Grapher
                    grapherState={makeGrapherState(ColumnTypeNames.String)}
                />
            )

            hoverSegment(container, { laneIndex: 0, segmentIndex: 1 })

            const tooltip = screen.getByRole("tooltip")
            expect(within(tooltip).getByText("No data")).toBeTruthy()
            expect(within(tooltip).getByText("2003–2004")).toBeTruthy()
            expect(
                tooltip.querySelector(".swimlane-tooltip__duration")
            ).toBeNull()
        })

        it("omits the duration for a single-time run", () => {
            const { container } = render(
                <Grapher
                    grapherState={makeGrapherState(ColumnTypeNames.String)}
                />
            )

            hoverSegment(container, { laneIndex: 0, segmentIndex: 2 })

            const tooltip = screen.getByRole("tooltip")
            expect(within(tooltip).getByText("Republic")).toBeTruthy()
            expect(within(tooltip).getByText("2005")).toBeTruthy()
            expect(
                tooltip.querySelector(".swimlane-tooltip__duration")
            ).toBeNull()
        })

        it("fades out when the cursor leaves the plot", async () => {
            const { container } = render(
                <Grapher
                    grapherState={makeGrapherState(ColumnTypeNames.String)}
                />
            )

            hoverSegment(container, { laneIndex: 1, segmentIndex: 0 })
            expect(screen.getByRole("tooltip")).toBeTruthy()

            const hitArea = container.querySelector(
                '#lanes ~ g > rect[fill-opacity="0"]'
            )
            fireEvent.mouseLeave(hitArea!.parentElement!)
            await waitFor(() =>
                expect(screen.queryByRole("tooltip")).toBeNull()
            )
        })
    })
})
