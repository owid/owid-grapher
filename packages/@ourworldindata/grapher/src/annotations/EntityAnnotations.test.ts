import { expect, it } from "vitest"
import { IndicatorAnnotation } from "@ourworldindata/types"
import { selectEntityPointAnnotations } from "./EntityAnnotations"

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
