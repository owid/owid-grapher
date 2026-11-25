import { describe, expect, it } from "vitest"
import { scaleLog } from "@visx/scale"

import { computeAxisTicks, LABELLED_MULTIPLIERS } from "./axisTicks.js"
import { INTERNATIONAL_DOLLAR } from "./constants.js"
import type { Currency } from "./types.js"

const xScale = (width: number) =>
    scaleLog<number>({ domain: [0.25, 1000], range: [0, width] })

const CHF: Currency = { code: "CHF", name: "Swiss franc", factor: 1 }

const labels = (ticks: ReturnType<typeof computeAxisTicks>) =>
    ticks.flatMap((tick) => (tick.label === undefined ? [] : [tick.label]))

describe(computeAxisTicks, () => {
    it("ticks every multiple of each power of ten, labelling 1, 2, 3 and 5 when there's room", () => {
        const ticks = computeAxisTicks(
            xScale(4000),
            INTERNATIONAL_DOLLAR,
            "daily",
            LABELLED_MULTIPLIERS,
            12
        )
        expect(ticks.map((tick) => tick.value)).toContain(4)
        expect(ticks.find((tick) => tick.value === 4)?.label).toBeUndefined()
        expect(labels(ticks)).toEqual([
            "$0.30",
            "$0.50",
            "$1",
            "$2",
            "$3",
            "$5",
            "$10",
            "$20",
            "$30",
            "$50",
            "$100",
            "$200",
            "$300",
            "$500",
            "$1k",
        ])
    })

    it("positions the ticks in int-$ a day whatever the units", () => {
        const ticks = computeAxisTicks(
            xScale(4000),
            INTERNATIONAL_DOLLAR,
            "monthly",
            LABELLED_MULTIPLIERS,
            12
        )
        // $100 a month is $3.29 a day
        const hundred = ticks.find((tick) => tick.label === "$100")
        expect(hundred?.value).toBeCloseTo(100 / (365 / 12))
    })

    it("drops lower-priority labels that would overlap, keeping the powers of ten", () => {
        const wide = labels(
            computeAxisTicks(
                xScale(4000),
                INTERNATIONAL_DOLLAR,
                "daily",
                LABELLED_MULTIPLIERS,
                12
            )
        )
        const tight = labels(
            computeAxisTicks(
                xScale(150),
                INTERNATIONAL_DOLLAR,
                "daily",
                LABELLED_MULTIPLIERS,
                12
            )
        )
        expect(tight.length).toBeLessThan(wide.length)
        expect(tight).toEqual(
            expect.arrayContaining(["$1", "$10", "$100", "$1k"])
        )
        expect(tight).not.toContain("$2")
    })

    it("names a currency written as its code on the first label only, and keeps that label", () => {
        const ticks = computeAxisTicks(
            xScale(150),
            CHF,
            "daily",
            LABELLED_MULTIPLIERS,
            12
        )
        const [first, ...rest] = labels(ticks)
        expect(first).toBe("CHF 0.30")
        expect(rest.length).toBeGreaterThan(0)
        for (const label of rest) expect(label).not.toContain("CHF")
        // Its neighbour at $1 gave way to it
        expect(rest).not.toContain("1")
    })

    it("has no ticks without a usable conversion", () => {
        expect(
            computeAxisTicks(
                xScale(1000),
                { ...CHF, factor: 0 },
                "daily",
                LABELLED_MULTIPLIERS,
                12
            )
        ).toEqual([])
    })
})
