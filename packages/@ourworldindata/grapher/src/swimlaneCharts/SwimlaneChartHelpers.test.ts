import { expect, it, describe } from "vitest"

import { Bounds } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import { Emphasis } from "../interaction/Emphasis"
import { FocusArray } from "../focus/FocusArray"
import { CategoricalBin } from "../color/ColorScaleBin"
import { NO_DATA_LABEL } from "../color/ColorScale"
import {
    ColoredSwimlaneCategorySegment,
    LANE_SPACING_FACTOR,
    MAX_LANE_HEIGHT,
    MIN_SEGMENT_WIDTH,
    PlacedSwimlaneSegment,
    SizedSwimlaneSeries,
    SwimlaneObservation,
    SwimlaneSegment,
    VisibleSwimlaneSegment,
} from "./SwimlaneChartConstants"
import {
    findLaneAtY,
    findSegmentAtX,
    toPlacedSwimlaneSeries,
    toRenderSwimlaneSegments,
    toRenderSwimlaneSeries,
    toSegmentOutlinePath,
    toSwimlaneSegments,
    toVisibleSwimlaneSegments,
} from "./SwimlaneChartHelpers"

interface Case {
    name: string
    observations: SwimlaneObservation[]
    timesAsc: Time[]
    expected: SwimlaneSegment[]
}

const cases: Case[] = [
    {
        name: "a clean run of one category merges into a single segment",
        observations: [
            { time: 2000, category: "A" },
            { time: 2001, category: "A" },
            { time: 2002, category: "A" },
            { time: 2003, category: "A" },
        ],
        timesAsc: [2000, 2001, 2002, 2003],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2003,
            },
        ],
    },
    {
        name: "two categories abutting produce two segments with no gap between them",
        observations: [
            { time: 2000, category: "A" },
            { time: 2001, category: "A" },
            { time: 2002, category: "B" },
            { time: 2003, category: "B" },
        ],
        timesAsc: [2000, 2001, 2002, 2003],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2001,
            },
            {
                kind: "category",
                category: "B",
                startTime: 2002,
                endTime: 2003,
            },
        ],
    },
    {
        name: "the same category on either side of a gap stays two category segments separated by a missing segment, not one merged run",
        observations: [
            { time: 2000, category: "A" },
            { time: 2001, category: "A" },
            { time: 2004, category: "A" },
        ],
        timesAsc: [2000, 2001, 2002, 2003, 2004],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2001,
            },
            {
                kind: "missing",
                startTime: 2002,
                endTime: 2003,
            },
            {
                kind: "category",
                category: "A",
                startTime: 2004,
                endTime: 2004,
            },
        ],
    },
    {
        name: "a leading gap precedes the entity's first observation",
        observations: [
            { time: 2001, category: "A" },
            { time: 2002, category: "A" },
        ],
        timesAsc: [2000, 2001, 2002],
        expected: [
            {
                kind: "missing",
                startTime: 2000,
                endTime: 2000,
            },
            {
                kind: "category",
                category: "A",
                startTime: 2001,
                endTime: 2002,
            },
        ],
    },
    {
        name: "a trailing gap follows the entity's last observation",
        observations: [
            { time: 2000, category: "A" },
            { time: 2001, category: "A" },
        ],
        timesAsc: [2000, 2001, 2002],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2001,
            },
            {
                kind: "missing",
                startTime: 2002,
                endTime: 2002,
            },
        ],
    },
    {
        name: "a single observation in a multi-time column is surrounded by missing segments",
        observations: [{ time: 2001, category: "A" }],
        timesAsc: [2000, 2001, 2002, 2003],
        expected: [
            {
                kind: "missing",
                startTime: 2000,
                endTime: 2000,
            },
            {
                kind: "category",
                category: "A",
                startTime: 2001,
                endTime: 2001,
            },
            {
                kind: "missing",
                startTime: 2002,
                endTime: 2003,
            },
        ],
    },
    {
        name: "a column with exactly one time gives one segment at that time",
        observations: [{ time: 2000, category: "A" }],
        timesAsc: [2000],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2000,
            },
        ],
    },
    {
        name: "decadal spacing with an observation at every decade merges into one segment without inventing a gap",
        observations: [
            { time: 1950, category: "A" },
            { time: 1960, category: "A" },
            { time: 1970, category: "A" },
            { time: 1980, category: "A" },
        ],
        timesAsc: [1950, 1960, 1970, 1980],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 1950,
                endTime: 1980,
            },
        ],
    },
    {
        name: "a gap spanning several consecutive missing times collapses to one missing segment",
        observations: [
            { time: 2000, category: "A" },
            { time: 2001, category: "A" },
            { time: 2005, category: "B" },
            { time: 2006, category: "B" },
        ],
        timesAsc: [2000, 2001, 2002, 2003, 2004, 2005, 2006],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2001,
            },
            {
                kind: "missing",
                startTime: 2002,
                endTime: 2004,
            },
            {
                kind: "category",
                category: "B",
                startTime: 2005,
                endTime: 2006,
            },
        ],
    },
    {
        name: "no observations at all gives one missing segment covering the whole column",
        observations: [],
        timesAsc: [2000, 2001, 2002],
        expected: [
            {
                kind: "missing",
                startTime: 2000,
                endTime: 2002,
            },
        ],
    },
    {
        name: "an empty timesAsc gives an empty array",
        observations: [],
        timesAsc: [],
        expected: [],
    },
]

describe(toSwimlaneSegments, () => {
    it.each(cases)("$name", ({ observations, timesAsc, expected }) => {
        expect(toSwimlaneSegments({ observations, timesAsc })).toEqual(expected)
    })
})

interface ClippingCase {
    name: string
    segments: SwimlaneSegment[]
    visibleTimesAsc: Time[]
    expected: VisibleSwimlaneSegment[]
}

const A_THEN_B: SwimlaneSegment[] = [
    { kind: "category", category: "A", startTime: 2000, endTime: 2002 },
    { kind: "category", category: "B", startTime: 2003, endTime: 2005 },
]

const clippingCases: ClippingCase[] = [
    {
        name: "a window covering every time crops nothing",
        segments: A_THEN_B,
        visibleTimesAsc: [2000, 2001, 2002, 2003, 2004, 2005],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2002,
                runStartTime: 2000,
                runEndTime: 2002,
            },
            {
                kind: "category",
                category: "B",
                startTime: 2003,
                endTime: 2005,
                runStartTime: 2003,
                runEndTime: 2005,
            },
        ],
    },
    {
        name: "a window starting inside the first run keeps the time that run began",
        segments: A_THEN_B,
        visibleTimesAsc: [2001, 2002, 2003, 2004, 2005],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2001,
                endTime: 2002,
                runStartTime: 2000,
                runEndTime: 2002,
            },
            {
                kind: "category",
                category: "B",
                startTime: 2003,
                endTime: 2005,
                runStartTime: 2003,
                runEndTime: 2005,
            },
        ],
    },
    {
        name: "a window ending inside the last run keeps the time that run ended",
        segments: A_THEN_B,
        visibleTimesAsc: [2000, 2001, 2002, 2003, 2004],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2002,
                runStartTime: 2000,
                runEndTime: 2002,
            },
            {
                kind: "category",
                category: "B",
                startTime: 2003,
                endTime: 2004,
                runStartTime: 2003,
                runEndTime: 2005,
            },
        ],
    },
    {
        name: "a window starting where a run starts leaves the drawn segment whole",
        segments: A_THEN_B,
        visibleTimesAsc: [2003, 2004, 2005],
        expected: [
            {
                kind: "category",
                category: "B",
                startTime: 2003,
                endTime: 2005,
                runStartTime: 2003,
                runEndTime: 2005,
            },
        ],
    },
    {
        name: "a run reaching past both ends of the window keeps both of its own times",
        segments: [
            { kind: "category", category: "A", startTime: 1900, endTime: 2000 },
        ],
        visibleTimesAsc: [1950, 1960, 1970],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 1950,
                endTime: 1970,
                runStartTime: 1900,
                runEndTime: 2000,
            },
        ],
    },
    {
        name: "a run cropped down to a single visible time keeps its whole range",
        segments: A_THEN_B,
        visibleTimesAsc: [2002, 2003, 2004, 2005],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2002,
                endTime: 2002,
                runStartTime: 2000,
                runEndTime: 2002,
            },
            {
                kind: "category",
                category: "B",
                startTime: 2003,
                endTime: 2005,
                runStartTime: 2003,
                runEndTime: 2005,
            },
        ],
    },
    {
        name: "segments outside the window are dropped",
        segments: A_THEN_B,
        visibleTimesAsc: [2004, 2005],
        expected: [
            {
                kind: "category",
                category: "B",
                startTime: 2004,
                endTime: 2005,
                runStartTime: 2003,
                runEndTime: 2005,
            },
        ],
    },
    {
        name: "a missing segment is clamped to the window and carries no run",
        segments: [{ kind: "missing", startTime: 2000, endTime: 2005 }],
        visibleTimesAsc: [2001, 2002],
        expected: [{ kind: "missing", startTime: 2001, endTime: 2002 }],
    },
    {
        name: "an empty window drops every segment",
        segments: A_THEN_B,
        visibleTimesAsc: [],
        expected: [],
    },
]

describe(toVisibleSwimlaneSegments, () => {
    it.each(clippingCases)(
        "$name",
        ({ segments, visibleTimesAsc, expected }) => {
            expect(
                toVisibleSwimlaneSegments({ segments, visibleTimesAsc })
            ).toEqual(expected)
        }
    )
})

describe(toVisibleSwimlaneSegments, () => {
    it.each(clippingCases)(
        "$name",
        ({ segments, visibleTimesAsc, expected }) => {
            expect(
                toVisibleSwimlaneSegments({ segments, visibleTimesAsc })
            ).toEqual(expected)
        }
    )
})

const TIME_DOMAIN: [Time, Time] = [2000, 2004]
const BOUNDS = new Bounds(0, 0, 200, 100)

function label(): SeriesLabelState {
    return new SeriesLabelState({ text: "France", maxWidth: 100, fontSize: 12 })
}

function placeTime(time: Time): number {
    const [start, end] = TIME_DOMAIN
    return BOUNDS.left + ((time - start) / (end - start)) * BOUNDS.width
}

function categorySegment(
    segment: Omit<ColoredSwimlaneCategorySegment, "runStartTime" | "runEndTime">
): ColoredSwimlaneCategorySegment {
    return {
        ...segment,
        runStartTime: segment.startTime,
        runEndTime: segment.endTime,
    }
}

function placedCategorySegment(
    overrides: Partial<PlacedSwimlaneSegment> & { x: number; width: number }
): PlacedSwimlaneSegment {
    return {
        kind: "category",
        category: "A",
        color: "#123456",
        startTime: 2000,
        endTime: 2000,
        runStartTime: 2000,
        runEndTime: 2000,
        y: 0,
        height: 10,
        ...overrides,
    }
}

function series(
    overrides: Partial<SizedSwimlaneSeries> = {}
): SizedSwimlaneSeries {
    return {
        seriesName: "France",
        entityName: "France",
        color: "#123456",
        label: label(),
        segments: [
            categorySegment({
                kind: "category",
                category: "A",
                color: "#123456",
                startTime: 2000,
                endTime: 2004,
            }),
        ],
        ...overrides,
    }
}

function categoricalBin(value: string): CategoricalBin {
    return new CategoricalBin({
        index: 0,
        value,
        label: value,
        color: "#000000",
    })
}

const NO_DATA_BIN = categoricalBin(NO_DATA_LABEL)

describe(toPlacedSwimlaneSeries, () => {
    it("returns an empty array for no series", () => {
        expect(
            toPlacedSwimlaneSeries({ series: [], bounds: BOUNDS, placeTime })
        ).toEqual([])
    })

    it("starts the first segment at the plot's left edge and ends the last at its right edge", () => {
        const [placed] = toPlacedSwimlaneSeries({
            series: [series()],
            bounds: BOUNDS,
            placeTime,
        })
        const [segment] = placed.placedSegments

        expect(segment.x).toEqual(BOUNDS.left)
        expect(segment.x + segment.width).toEqual(BOUNDS.right)
    })

    it("ends a segment where the next one begins", () => {
        const [placed] = toPlacedSwimlaneSeries({
            series: [
                series({
                    segments: [
                        categorySegment({
                            kind: "category",
                            category: "A",
                            color: "#123456",
                            startTime: 2000,
                            endTime: 2001,
                        }),
                        categorySegment({
                            kind: "category",
                            category: "B",
                            color: "#654321",
                            startTime: 2002,
                            endTime: 2004,
                        }),
                    ],
                }),
            ],
            bounds: BOUNDS,
            placeTime,
        })
        const [first, second] = placed.placedSegments

        expect(first.x + first.width).toEqual(second.x)
        expect(second.x + second.width).toEqual(BOUNDS.right)
    })

    it("gives a lone final observation the minimum width", () => {
        const [placed] = toPlacedSwimlaneSeries({
            series: [
                series({
                    segments: [
                        categorySegment({
                            kind: "category",
                            category: "A",
                            color: "#123456",
                            startTime: 2001,
                            endTime: 2001,
                        }),
                    ],
                }),
            ],
            bounds: BOUNDS,
            placeTime,
        })
        const [segment] = placed.placedSegments

        expect(segment.x).toEqual(placeTime(2001))
        expect(segment.width).toEqual(MIN_SEGMENT_WIDTH)
    })

    it("spaces lane centres evenly and keeps every lane inside the bounds", () => {
        const placed = toPlacedSwimlaneSeries({
            series: [
                series({ seriesName: "France", entityName: "France" }),
                series({ seriesName: "Chile", entityName: "Chile" }),
                series({ seriesName: "Japan", entityName: "Japan" }),
            ],
            bounds: BOUNDS,
            placeTime,
        })

        const centres = placed.map((series) => series.y)
        const gaps = centres.slice(1).map((y, index) => y - centres[index])

        expect(gaps[0]).toBeCloseTo(gaps[1])
        for (const series of placed) {
            for (const segment of series.placedSegments) {
                expect(series.y + segment.y).toBeGreaterThanOrEqual(BOUNDS.top)
                expect(
                    series.y + segment.y + segment.height
                ).toBeLessThanOrEqual(BOUNDS.bottom)
            }
        }

        const slotHeight = BOUNDS.height / placed.length
        expect(placed[0].placedSegments[0].height).toBeCloseTo(
            slotHeight * (1 - LANE_SPACING_FACTOR)
        )
    })

    it("caps the lane height and centres the lane block when the plot is taller than the cap allows", () => {
        const tallBounds = new Bounds(0, 0, 200, 400)
        const [placed] = toPlacedSwimlaneSeries({
            series: [series()],
            bounds: tallBounds,
            placeTime,
        })

        expect(placed.placedSegments[0].height).toBeCloseTo(MAX_LANE_HEIGHT)
        expect(placed.y).toEqual(tallBounds.top + tallBounds.height / 2)
    })

    it("places a missing segment with the same geometry as a category segment", () => {
        const [placed] = toPlacedSwimlaneSeries({
            series: [
                series({
                    segments: [
                        {
                            kind: "missing",
                            startTime: 2000,
                            endTime: 2004,
                        },
                    ],
                }),
            ],
            bounds: BOUNDS,
            placeTime,
        })
        const [segment] = placed.placedSegments

        expect(segment.kind).toEqual("missing")
        expect(segment.x).toEqual(BOUNDS.left)
        expect(segment.x + segment.width).toEqual(BOUNDS.right)
        expect(segment.y + segment.height / 2).toEqual(0)
    })
})

describe(toSegmentOutlinePath, () => {
    const box = { x: 10, y: 20, width: 60, height: 30 }

    it("tapers the start edge to a point when the window crops it", () => {
        expect(
            toSegmentOutlinePath({
                ...box,
                isStartCropped: true,
                isEndCropped: false,
            })
        ).toEqual("M 10,35 L 22,20 L 70,20 L 70,50 L 22,50 Z")
    })

    it("tapers the end edge to a point when the window crops it", () => {
        expect(
            toSegmentOutlinePath({
                ...box,
                isStartCropped: false,
                isEndCropped: true,
            })
        ).toEqual("M 10,20 L 58,20 L 70,35 L 58,50 L 10,50 Z")
    })

    it("tapers both edges of a run the window crops on both sides", () => {
        expect(
            toSegmentOutlinePath({
                ...box,
                isStartCropped: true,
                isEndCropped: true,
            })
        ).toEqual("M 10,35 L 22,20 L 58,20 L 70,35 L 58,50 L 22,50 Z")
    })

    it("shrinks the taper so a narrow segment keeps a flat side", () => {
        expect(
            toSegmentOutlinePath({
                ...box,
                width: 6,
                isStartCropped: true,
                isEndCropped: false,
            })
        ).toEqual("M 10,35 L 12,20 L 16,20 L 16,50 L 12,50 Z")
    })
})

describe(findSegmentAtX, () => {
    const withHole: PlacedSwimlaneSegment[] = [
        placedCategorySegment({ x: 0, width: 10 }),
        placedCategorySegment({ x: 10, width: 10 }),
        placedCategorySegment({ x: 30, width: 10 }),
    ]

    it("finds the segment starting at a boundary x, left edge inclusive", () => {
        expect(findSegmentAtX(withHole, 10)).toBe(withHole[1])
    })

    it("finds nothing at the right edge of the last segment", () => {
        expect(findSegmentAtX(withHole, 40)).toBeUndefined()
    })

    it("finds nothing past the last segment", () => {
        expect(findSegmentAtX(withHole, 100)).toBeUndefined()
    })

    it("finds nothing before the first segment", () => {
        expect(findSegmentAtX(withHole, -5)).toBeUndefined()
    })

    it("finds nothing in a hole between two segments", () => {
        expect(findSegmentAtX(withHole, 25)).toBeUndefined()
    })

    it("returns undefined for an empty list", () => {
        expect(findSegmentAtX([], 0)).toBeUndefined()
    })

    it("picks the later segment where a sliver clamp makes it overlap its neighbour", () => {
        const overlapping: PlacedSwimlaneSegment[] = [
            placedCategorySegment({ x: 0, width: 15 }),
            placedCategorySegment({ x: 10, width: 10 }),
        ]

        expect(findSegmentAtX(overlapping, 12)).toBe(overlapping[1])
    })
})

describe(findLaneAtY, () => {
    function twoLanes(): ReturnType<typeof toPlacedSwimlaneSeries> {
        return toPlacedSwimlaneSeries({
            series: [
                series({ seriesName: "France", entityName: "France" }),
                series({ seriesName: "Chile", entityName: "Chile" }),
            ],
            bounds: BOUNDS,
            placeTime,
        })
    }

    it("resolves a y inside a lane's drawn band to that lane", () => {
        const [france, chile] = twoLanes()
        expect(findLaneAtY(twoLanes(), france.y)?.seriesName).toEqual("France")
        expect(findLaneAtY(twoLanes(), chile.y)?.seriesName).toEqual("Chile")
    })

    it("resolves a y in the spacing between two lanes to the nearer lane", () => {
        const [france, chile] = twoLanes()
        const spacingTop = Math.min(france.y, chile.y) + france.slotHeight / 2
        const spacingBottom =
            Math.max(france.y, chile.y) - france.slotHeight / 2

        expect(findLaneAtY(twoLanes(), spacingTop - 2)?.seriesName).toEqual(
            "France"
        )
        expect(findLaneAtY(twoLanes(), spacingBottom + 2)?.seriesName).toEqual(
            "Chile"
        )
    })

    it("finds nothing above the block of lanes", () => {
        expect(findLaneAtY(twoLanes(), BOUNDS.top - 10)).toBeUndefined()
    })

    it("finds nothing below the block of lanes", () => {
        expect(findLaneAtY(twoLanes(), BOUNDS.bottom + 10)).toBeUndefined()
    })
})

describe(toRenderSwimlaneSegments, () => {
    it("yields Default for every segment when no focus is given", () => {
        const [placed] = toPlacedSwimlaneSeries({
            series: [series()],
            bounds: BOUNDS,
            placeTime,
        })

        const rendered = toRenderSwimlaneSegments({
            segments: placed.placedSegments,
        })

        expect(
            rendered.every((segment) => segment.emphasis === Emphasis.Default)
        ).toBe(true)
    })

    it("highlights the hovered segment and mutes its siblings in the same lane", () => {
        const [placed] = toPlacedSwimlaneSeries({
            series: [
                series({
                    segments: [
                        categorySegment({
                            kind: "category",
                            category: "A",
                            color: "#123456",
                            startTime: 2000,
                            endTime: 2001,
                        }),
                        categorySegment({
                            kind: "category",
                            category: "B",
                            color: "#654321",
                            startTime: 2002,
                            endTime: 2004,
                        }),
                    ],
                }),
            ],
            bounds: BOUNDS,
            placeTime,
        })
        const [hovered] = placed.placedSegments

        const rendered = toRenderSwimlaneSegments({
            segments: placed.placedSegments,
            hoveredSegment: hovered,
        })

        expect(rendered[0].emphasis).toEqual(Emphasis.Highlighted)
        expect(rendered[1].emphasis).toEqual(Emphasis.Muted)
    })

    it("highlights the missing segments and mutes the category segments when the no-data bin is hovered", () => {
        const [placed] = toPlacedSwimlaneSeries({
            series: [
                series({
                    segments: [
                        {
                            kind: "missing",
                            startTime: 2000,
                            endTime: 2001,
                        },
                        categorySegment({
                            kind: "category",
                            category: "A",
                            color: "#123456",
                            startTime: 2002,
                            endTime: 2004,
                        }),
                    ],
                }),
            ],
            bounds: BOUNDS,
            placeTime,
        })

        const rendered = toRenderSwimlaneSegments({
            segments: placed.placedSegments,
            hoveredLegendBin: NO_DATA_BIN,
        })

        expect(rendered[0].emphasis).toEqual(Emphasis.Highlighted)
        expect(rendered[1].emphasis).toEqual(Emphasis.Muted)
    })
})

describe(toRenderSwimlaneSeries, () => {
    function placedFranceAndChile(): ReturnType<typeof toPlacedSwimlaneSeries> {
        return toPlacedSwimlaneSeries({
            series: [
                series({ seriesName: "France", entityName: "France" }),
                series({ seriesName: "Chile", entityName: "Chile" }),
            ],
            bounds: BOUNDS,
            placeTime,
        })
    }

    it("leaves every row and every segment at Default when the focus array is empty", () => {
        const rendered = toRenderSwimlaneSeries({
            series: placedFranceAndChile(),
            focusArray: new FocusArray(),
        })

        for (const row of rendered) {
            expect(row.emphasis).toEqual(Emphasis.Default)
            expect(
                row.placedSegments.every(
                    (segment) => segment.emphasis === Emphasis.Default
                )
            ).toBe(true)
        }
    })

    it("highlights a focused lane and mutes its neighbours", () => {
        const focusArray = new FocusArray().add("France")
        const [france, chile] = toRenderSwimlaneSeries({
            series: placedFranceAndChile(),
            focusArray,
        })

        expect(france.emphasis).toEqual(Emphasis.Highlighted)
        expect(
            france.placedSegments.every(
                (segment) => segment.emphasis === Emphasis.Highlighted
            )
        ).toBe(true)

        expect(chile.emphasis).toEqual(Emphasis.Muted)
        expect(
            chile.placedSegments.every(
                (segment) => segment.emphasis === Emphasis.Muted
            )
        ).toBe(true)
    })

    it("mutes every lane when the focused name matches none of them", () => {
        const focusArray = new FocusArray().add("Germany")
        const rendered = toRenderSwimlaneSeries({
            series: placedFranceAndChile(),
            focusArray,
        })

        for (const row of rendered) {
            expect(row.emphasis).toEqual(Emphasis.Muted)
            expect(
                row.placedSegments.every(
                    (segment) => segment.emphasis === Emphasis.Muted
                )
            ).toBe(true)
        }
    })

    function placedFranceWithTwoSegmentsAndChile(): ReturnType<
        typeof toPlacedSwimlaneSeries
    > {
        return toPlacedSwimlaneSeries({
            series: [
                series({
                    seriesName: "France",
                    entityName: "France",
                    segments: [
                        categorySegment({
                            kind: "category",
                            category: "A",
                            color: "#123456",
                            startTime: 2000,
                            endTime: 2001,
                        }),
                        categorySegment({
                            kind: "category",
                            category: "B",
                            color: "#654321",
                            startTime: 2002,
                            endTime: 2004,
                        }),
                    ],
                }),
                series({ seriesName: "Chile", entityName: "Chile" }),
            ],
            bounds: BOUNDS,
            placeTime,
        })
    }

    it("highlights the segment under a hovered point and mutes every other segment, including the rest of its own lane", () => {
        const placed = placedFranceWithTwoSegmentsAndChile()
        const [france] = placed
        const hoveredSegment = france.placedSegments[0]

        const [renderedFrance, renderedChile] = toRenderSwimlaneSeries({
            series: placed,
            hoveredPoint: {
                x: hoveredSegment.x,
                laneEntityName: "France",
            },
            focusArray: new FocusArray(),
        })

        expect(renderedFrance.placedSegments[0].emphasis).toEqual(
            Emphasis.Highlighted
        )
        expect(renderedFrance.placedSegments[1].emphasis).toEqual(
            Emphasis.Muted
        )
        expect(
            renderedChile.placedSegments.every(
                (segment) => segment.emphasis === Emphasis.Muted
            )
        ).toBe(true)
    })

    it("leaves every row at Default when a lane is only hovered", () => {
        const placed = placedFranceWithTwoSegmentsAndChile()
        const [france] = placed

        const rendered = toRenderSwimlaneSeries({
            series: placed,
            hoveredPoint: {
                x: france.placedSegments[0].x,
                laneEntityName: "France",
            },
            focusArray: new FocusArray(),
        })

        for (const row of rendered) {
            expect(row.emphasis).toEqual(Emphasis.Default)
        }
    })

    it("leaves every segment at Default when the hovered point has no lane under it", () => {
        const placed = placedFranceWithTwoSegmentsAndChile()

        const rendered = toRenderSwimlaneSeries({
            series: placed,
            hoveredPoint: { x: placed[0].placedSegments[0].x },
            focusArray: new FocusArray(),
        })

        for (const row of rendered) {
            expect(
                row.placedSegments.every(
                    (segment) => segment.emphasis === Emphasis.Default
                )
            ).toBe(true)
        }
    })

    it("keeps a hovered segment Highlighted inside a lane muted by focus", () => {
        const placed = placedFranceWithTwoSegmentsAndChile()
        const [france] = placed
        const hoveredSegment = france.placedSegments[0]
        const focusArray = new FocusArray().add("Chile")

        const [renderedFrance] = toRenderSwimlaneSeries({
            series: placed,
            hoveredPoint: { x: hoveredSegment.x, laneEntityName: "France" },
            focusArray,
        })

        expect(renderedFrance.emphasis).toEqual(Emphasis.Muted)
        expect(renderedFrance.placedSegments[0].emphasis).toEqual(
            Emphasis.Highlighted
        )
    })

    it("highlights every segment of the hovered category across every lane and mutes the rest", () => {
        const placed = placedFranceWithTwoSegmentsAndChile()

        const [renderedFrance, renderedChile] = toRenderSwimlaneSeries({
            series: placed,
            focusArray: new FocusArray(),
            hoveredLegendBin: categoricalBin("A"),
        })

        expect(renderedFrance.placedSegments[0].emphasis).toEqual(
            Emphasis.Highlighted
        )
        expect(renderedFrance.placedSegments[1].emphasis).toEqual(
            Emphasis.Muted
        )
        expect(
            renderedChile.placedSegments.every(
                (segment) => segment.emphasis === Emphasis.Highlighted
            )
        ).toBe(true)
    })

    it("mutes every segment of a lane whose segments are all of another category", () => {
        const placed = toPlacedSwimlaneSeries({
            series: [
                series({ seriesName: "France", entityName: "France" }),
                series({
                    seriesName: "Chile",
                    entityName: "Chile",
                    segments: [
                        categorySegment({
                            kind: "category",
                            category: "B",
                            color: "#654321",
                            startTime: 2000,
                            endTime: 2004,
                        }),
                    ],
                }),
            ],
            bounds: BOUNDS,
            placeTime,
        })

        const [renderedFrance, renderedChile] = toRenderSwimlaneSeries({
            series: placed,
            focusArray: new FocusArray(),
            hoveredLegendBin: categoricalBin("A"),
        })

        expect(
            renderedFrance.placedSegments.every(
                (segment) => segment.emphasis === Emphasis.Highlighted
            )
        ).toBe(true)
        expect(
            renderedChile.placedSegments.every(
                (segment) => segment.emphasis === Emphasis.Muted
            )
        ).toBe(true)
    })

    it("keeps a segment of the hovered category Highlighted inside a lane muted by focus", () => {
        const placed = placedFranceWithTwoSegmentsAndChile()
        const focusArray = new FocusArray().add("Chile")

        const [renderedFrance] = toRenderSwimlaneSeries({
            series: placed,
            focusArray,
            hoveredLegendBin: categoricalBin("A"),
        })

        expect(renderedFrance.emphasis).toEqual(Emphasis.Muted)
        expect(renderedFrance.placedSegments[0].emphasis).toEqual(
            Emphasis.Highlighted
        )
    })

    it("leaves row emphasis at Default under legend hover", () => {
        const rendered = toRenderSwimlaneSeries({
            series: placedFranceAndChile(),
            focusArray: new FocusArray(),
            hoveredLegendBin: categoricalBin("A"),
        })

        for (const row of rendered) {
            expect(row.emphasis).toEqual(Emphasis.Default)
        }
    })
})
