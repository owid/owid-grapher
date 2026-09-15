import { expect, it, describe } from "vitest"

import { Bounds } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import {
    MIN_SEGMENT_WIDTH,
    OrdinalSwimlaneCategories,
    SizedSwimlaneSeries,
    SwimlaneObservation,
    SwimlaneSegment,
} from "./SwimlaneChartConstants"
import {
    toPlacedSwimlaneSegmentsByCategoryRank,
    toPlacedSwimlaneSeries,
    toSwimlaneSegments,
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

const TIME_DOMAIN: [Time, Time] = [2000, 2004]
const BOUNDS = new Bounds(0, 0, 200, 100)

function label(): SeriesLabelState {
    return new SeriesLabelState({ text: "France", maxWidth: 100, fontSize: 12 })
}

function placeTime(time: Time): number {
    const [start, end] = TIME_DOMAIN
    return BOUNDS.left + ((time - start) / (end - start)) * BOUNDS.width
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
            {
                kind: "category",
                category: "A",
                color: "#123456",
                startTime: 2000,
                endTime: 2004,
            },
        ],
        ...overrides,
    }
}

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
                        {
                            kind: "category",
                            category: "A",
                            color: "#123456",
                            startTime: 2000,
                            endTime: 2001,
                        },
                        {
                            kind: "category",
                            category: "B",
                            color: "#654321",
                            startTime: 2002,
                            endTime: 2004,
                        },
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
                        {
                            kind: "category",
                            category: "A",
                            color: "#123456",
                            startTime: 2001,
                            endTime: 2001,
                        },
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
                    {
                        kind: "category",
                        category: "B",
                        color: "#123456",
                        startTime: 2000,
                        endTime: 2004,
                    },
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
                    {
                        kind: "category",
                        category: "D",
                        color: "#123456",
                        startTime: 2000,
                        endTime: 2004,
                    },
                ],
            }),
            categories: CATEGORIES,
            bounds: BOUNDS,
            placeTime,
        })

        expect(segment.y).toEqual(BOUNDS.top)
    })

    it("gives every band the plot height divided by the number of categories", () => {
        const [segment] = toPlacedSwimlaneSegmentsByCategoryRank({
            series: series({
                segments: [
                    {
                        kind: "category",
                        category: "A",
                        color: "#123456",
                        startTime: 2000,
                        endTime: 2004,
                    },
                ],
            }),
            categories: CATEGORIES,
            bounds: BOUNDS,
            placeTime,
        })

        expect(segment.height).toEqual(BAND_HEIGHT)
        expect(segment.y + segment.height).toEqual(BOUNDS.bottom)
    })

    it("drops a missing segment and stops the preceding segment where it began", () => {
        const placed = toPlacedSwimlaneSegmentsByCategoryRank({
            series: series({
                segments: [
                    {
                        kind: "category",
                        category: "A",
                        color: "#123456",
                        startTime: 2000,
                        endTime: 2001,
                    },
                    {
                        kind: "missing",
                        startTime: 2002,
                        endTime: 2002,
                    },
                    {
                        kind: "category",
                        category: "B",
                        color: "#654321",
                        startTime: 2003,
                        endTime: 2004,
                    },
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
                    {
                        kind: "category",
                        category: "A",
                        color: "#123456",
                        startTime: 2001,
                        endTime: 2001,
                    },
                ],
            }),
            categories: CATEGORIES,
            bounds: BOUNDS,
            placeTime,
        })

        expect(segment.width).toEqual(MIN_SEGMENT_WIDTH)
    })
})
