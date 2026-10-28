import { expect, it } from "vitest"
import { EntityName, IndicatorAnnotation } from "@ourworldindata/types"
import {
    selectEntityPointAnnotations,
    selectEntityRangeAnnotations,
} from "./EntityAnnotations"

it("keeps points that name the entity, alone or among others", () => {
    const annotations: IndicatorAnnotation[] = [
        {
            text: "France only",
            entityNames: ["France"],
            timeScope: "point",
            time: 2000,
        },
        {
            text: "Chad only",
            entityNames: ["Chad"],
            timeScope: "point",
            time: 2001,
        },
        {
            text: "Chad and France",
            entityNames: ["Chad", "France"],
            timeScope: "point",
            time: 2002,
        },
    ]

    const selected = selectEntityPointAnnotations(
        annotations,
        "Chad",
        [1990, 2010]
    )

    expect(selected.map((annotation) => annotation.text)).toEqual([
        "Chad only",
        "Chad and France",
    ])
})

it("drops all-time, range and indicator-wide annotations", () => {
    const annotations: IndicatorAnnotation[] = [
        { text: "all", entityNames: ["Chad"], timeScope: "all" },
        {
            text: "range",
            entityNames: ["Chad"],
            timeScope: "range",
            startTime: 2000,
            endTime: 2005,
        },
        { text: "indicator-wide", timeScope: "point", time: 2000 },
    ]

    expect(
        selectEntityPointAnnotations(annotations, "Chad", [1990, 2010])
    ).toEqual([])
})

it("keeps points on the edges of the time range and drops points outside it", () => {
    const annotations: IndicatorAnnotation[] = [
        {
            text: "before",
            entityNames: ["Chad"],
            timeScope: "point",
            time: 1999,
        },
        {
            text: "start",
            entityNames: ["Chad"],
            timeScope: "point",
            time: 2000,
        },
        { text: "end", entityNames: ["Chad"], timeScope: "point", time: 2010 },
        {
            text: "after",
            entityNames: ["Chad"],
            timeScope: "point",
            time: 2011,
        },
    ]

    const selected = selectEntityPointAnnotations(
        annotations,
        "Chad",
        [2000, 2010]
    )

    expect(selected.map((annotation) => annotation.text)).toEqual([
        "start",
        "end",
    ])
})

it("returns points in ascending time order", () => {
    const annotations: IndicatorAnnotation[] = [
        { text: "late", entityNames: ["Chad"], timeScope: "point", time: 2008 },
        {
            text: "early",
            entityNames: ["Chad"],
            timeScope: "point",
            time: 2001,
        },
        {
            text: "middle",
            entityNames: ["Chad"],
            timeScope: "point",
            time: 2005,
        },
    ]

    const selected = selectEntityPointAnnotations(
        annotations,
        "Chad",
        [2000, 2010]
    )

    expect(selected.map((annotation) => annotation.text)).toEqual([
        "early",
        "middle",
        "late",
    ])
})

it("compares day offsets, including negative ones, against a day-number time range", () => {
    const annotations: IndicatorAnnotation[] = [
        {
            text: "pre-epoch",
            entityNames: ["Chad"],
            timeScope: "point",
            time: -1450,
        },
        {
            text: "recent",
            entityNames: ["Chad"],
            timeScope: "point",
            time: 18000,
        },
        {
            text: "too late",
            entityNames: ["Chad"],
            timeScope: "point",
            time: 18001,
        },
    ]

    const selected = selectEntityPointAnnotations(
        annotations,
        "Chad",
        [-1500, 18000]
    )

    expect(selected.map((annotation) => annotation.text)).toEqual([
        "pre-epoch",
        "recent",
    ])
})

function rangeAnnotation(
    text: string,
    startTime: number,
    endTime: number,
    entityNames: [EntityName, ...EntityName[]] = ["Chad"]
): IndicatorAnnotation {
    return { text, entityNames, timeScope: "range", startTime, endTime }
}

it("keeps ranges that name the entity, alone or among others", () => {
    const annotations = [
        rangeAnnotation("France only", 2000, 2002, ["France"]),
        rangeAnnotation("Chad only", 2001, 2003, ["Chad"]),
        rangeAnnotation("Chad and France", 2002, 2004, ["Chad", "France"]),
    ]

    const selected = selectEntityRangeAnnotations(
        annotations,
        "Chad",
        [1990, 2010]
    )

    expect(selected.map((annotation) => annotation.text)).toEqual([
        "Chad only",
        "Chad and France",
    ])
})

it("drops all-time, point and indicator-wide annotations when selecting ranges", () => {
    const annotations: IndicatorAnnotation[] = [
        { text: "all", entityNames: ["Chad"], timeScope: "all" },
        {
            text: "point",
            entityNames: ["Chad"],
            timeScope: "point",
            time: 2000,
        },
        {
            text: "indicator-wide",
            timeScope: "range",
            startTime: 2000,
            endTime: 2005,
        },
    ]

    expect(
        selectEntityRangeAnnotations(annotations, "Chad", [1990, 2010])
    ).toEqual([])
})

it("keeps ranges that overlap the time range, edges included, and returns them unclipped", () => {
    const annotations = [
        rangeAnnotation("before", 1990, 1999),
        rangeAnnotation("ends at start", 1991, 2000),
        rangeAnnotation("covers", 1992, 2015),
        rangeAnnotation("straddles start", 1995, 2005),
        rangeAnnotation("inside", 2003, 2007),
        rangeAnnotation("straddles end", 2008, 2015),
        rangeAnnotation("starts at end", 2010, 2020),
        rangeAnnotation("after", 2011, 2020),
    ]

    const selected = selectEntityRangeAnnotations(
        annotations,
        "Chad",
        [2000, 2010]
    )

    expect(
        selected.map(({ text, startTime, endTime }) => [
            text,
            startTime,
            endTime,
        ])
    ).toEqual([
        ["ends at start", 1991, 2000],
        ["covers", 1992, 2015],
        ["straddles start", 1995, 2005],
        ["inside", 2003, 2007],
        ["straddles end", 2008, 2015],
        ["starts at end", 2010, 2020],
    ])
})

it("returns ranges in ascending start time order", () => {
    const annotations = [
        rangeAnnotation("late", 2008, 2009),
        rangeAnnotation("early", 2001, 2002),
        rangeAnnotation("middle", 2005, 2006),
    ]

    const selected = selectEntityRangeAnnotations(
        annotations,
        "Chad",
        [2000, 2010]
    )

    expect(selected.map((annotation) => annotation.text)).toEqual([
        "early",
        "middle",
        "late",
    ])
})
