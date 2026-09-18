import { expect, it, describe } from "vitest"

import { Bounds } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import {
    CategoricalSwimlaneCategories,
    ColoredSwimlaneCategorySegment,
    LANE_SPACING_FACTOR,
    MAX_LANE_HEIGHT,
    MIN_SEGMENT_WIDTH,
    OrdinalSwimlaneCategories,
    SizedSwimlaneSeries,
    SwimlaneObservation,
    SwimlaneSegment,
    VisibleSwimlaneSegment,
} from "./SwimlaneChartConstants"
import {
    toPlacedSwimlaneSegmentsByCategoryRank,
    toPlacedSwimlaneSeries,
    toRankedSwimlane,
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

const ORDINAL_CATEGORIES: OrdinalSwimlaneCategories = {
    kind: "ordinal",
    values: ["A", "B"],
}
const CATEGORICAL_CATEGORIES: CategoricalSwimlaneCategories = {
    kind: "categorical",
    values: ["A", "B"],
}

describe(toRankedSwimlane, () => {
    it("spreads out a single entity with ordinal categories", () => {
        const oneSeries = [series()]
        expect(
            toRankedSwimlane({
                series: oneSeries,
                categories: ORDINAL_CATEGORIES,
            })
        ).toEqual({ series: oneSeries[0], categories: ORDINAL_CATEGORIES })
    })

    it("stays in lane mode for a single entity with categorical categories", () => {
        expect(
            toRankedSwimlane({
                series: [series()],
                categories: CATEGORICAL_CATEGORIES,
            })
        ).toBeUndefined()
    })

    it("stays in lane mode for several entities with ordinal categories", () => {
        expect(
            toRankedSwimlane({
                series: [
                    series(),
                    series({ seriesName: "Chile", entityName: "Chile" }),
                ],
                categories: ORDINAL_CATEGORIES,
            })
        ).toBeUndefined()
    })

    it("stays in lane mode for several entities with categorical categories", () => {
        expect(
            toRankedSwimlane({
                series: [
                    series(),
                    series({ seriesName: "Chile", entityName: "Chile" }),
                ],
                categories: CATEGORICAL_CATEGORIES,
            })
        ).toBeUndefined()
    })

    it("stays in lane mode when there are no categories", () => {
        expect(
            toRankedSwimlane({ series: [series()], categories: undefined })
        ).toBeUndefined()
    })
})

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

const CATEGORIES: OrdinalSwimlaneCategories = {
    kind: "ordinal",
    values: ["A", "B", "C", "D"],
}
const BAND_HEIGHT = BOUNDS.height / CATEGORIES.values.length

describe(toPlacedSwimlaneSegmentsByCategoryRank, () => {
    it("places a segment's y at its category's rank", () => {
        const [segment] = toPlacedSwimlaneSegmentsByCategoryRank({
            series: series({
                segments: [
                    categorySegment({
                        kind: "category",
                        category: "B",
                        color: "#123456",
                        startTime: 2000,
                        endTime: 2004,
                    }),
                ],
            }),
            categories: CATEGORIES,
            bounds: BOUNDS,
            placeTime,
        })

        expect(segment.y).toEqual(BOUNDS.bottom - 2 * BAND_HEIGHT)
    })

    it("puts the last-ranked category at the top of the plot", () => {
        const [segment] = toPlacedSwimlaneSegmentsByCategoryRank({
            series: series({
                segments: [
                    categorySegment({
                        kind: "category",
                        category: "D",
                        color: "#123456",
                        startTime: 2000,
                        endTime: 2004,
                    }),
                ],
            }),
            categories: CATEGORIES,
            bounds: BOUNDS,
            placeTime,
        })

        expect(segment.y).toEqual(BOUNDS.top)
    })

    it("shares the plot height out between the categories", () => {
        const [segment] = toPlacedSwimlaneSegmentsByCategoryRank({
            series: series({
                segments: [
                    categorySegment({
                        kind: "category",
                        category: "A",
                        color: "#123456",
                        startTime: 2000,
                        endTime: 2004,
                    }),
                ],
            }),
            categories: CATEGORIES,
            bounds: BOUNDS,
            placeTime,
        })

        expect(segment.height).toEqual(BAND_HEIGHT)
        expect(segment.y + segment.height).toEqual(BOUNDS.bottom)
    })

    it("caps the band height and centres the stack when the plot is taller than the cap allows", () => {
        const tallBounds = new Bounds(0, 0, 200, 400)
        const placed = toPlacedSwimlaneSegmentsByCategoryRank({
            series: series({
                segments: [
                    categorySegment({
                        kind: "category",
                        category: "A",
                        color: "#123456",
                        startTime: 2000,
                        endTime: 2002,
                    }),
                    categorySegment({
                        kind: "category",
                        category: "D",
                        color: "#654321",
                        startTime: 2003,
                        endTime: 2004,
                    }),
                ],
            }),
            categories: CATEGORIES,
            bounds: tallBounds,
            placeTime,
        })

        const stackHeight = MAX_LANE_HEIGHT * CATEGORIES.values.length
        const [lowest, highest] = placed

        expect(lowest.height).toEqual(MAX_LANE_HEIGHT)
        expect(lowest.y + lowest.height).toEqual(
            tallBounds.bottom - (tallBounds.height - stackHeight) / 2
        )
        expect(highest.y).toEqual(
            tallBounds.top + (tallBounds.height - stackHeight) / 2
        )
    })

    it("drops a missing segment and stops the preceding segment where it began", () => {
        const placed = toPlacedSwimlaneSegmentsByCategoryRank({
            series: series({
                segments: [
                    categorySegment({
                        kind: "category",
                        category: "A",
                        color: "#123456",
                        startTime: 2000,
                        endTime: 2001,
                    }),
                    {
                        kind: "missing",
                        startTime: 2002,
                        endTime: 2002,
                    },
                    categorySegment({
                        kind: "category",
                        category: "B",
                        color: "#654321",
                        startTime: 2003,
                        endTime: 2004,
                    }),
                ],
            }),
            categories: CATEGORIES,
            bounds: BOUNDS,
            placeTime,
        })

        expect(placed).toHaveLength(2)
        expect(placed[0].x + placed[0].width).toEqual(placeTime(2002))
    })

    it("gives a lone observation the minimum width", () => {
        const [segment] = toPlacedSwimlaneSegmentsByCategoryRank({
            series: series({
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
            categories: CATEGORIES,
            bounds: BOUNDS,
            placeTime,
        })

        expect(segment.width).toEqual(MIN_SEGMENT_WIDTH)
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
        ).toEqual("M 10,35 L 15,20 L 70,20 L 70,50 L 15,50 Z")
    })

    it("tapers the end edge to a point when the window crops it", () => {
        expect(
            toSegmentOutlinePath({
                ...box,
                isStartCropped: false,
                isEndCropped: true,
            })
        ).toEqual("M 10,20 L 65,20 L 70,35 L 65,50 L 10,50 Z")
    })

    it("tapers both edges of a run the window crops on both sides", () => {
        expect(
            toSegmentOutlinePath({
                ...box,
                isStartCropped: true,
                isEndCropped: true,
            })
        ).toEqual("M 10,35 L 15,20 L 65,20 L 70,35 L 65,50 L 15,50 Z")
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
