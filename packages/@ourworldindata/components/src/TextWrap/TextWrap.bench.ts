import { bench, describe } from "vitest"
import { Bounds } from "@ourworldindata/utils"
import { TextWrap, shortenWithEllipsis } from "./TextWrap.js"

// Text measurement is one of the most frequently called operations in a render:
// every axis tick, legend entry, label and title is measured (and often
// wrapped or truncated) to lay it out. Each individual call is cheap, but they
// happen thousands of times per chart, so the per-call cost matters.

/** Reference a value so it isn't flagged as an unused expression. */
function keep(value: unknown): void {
    if (value === undefined) throw new Error("expected a value")
}

const shortLabel = "Life expectancy"
const longTitle =
    "Share of the population living in extreme poverty, by world region, 1990 to 2019"
const paragraph =
    "Our World in Data presents the empirical evidence on global living " +
    "conditions across many dimensions such as health, poverty, education, " +
    "and the environment, drawing on data from research institutions and " +
    "statistical agencies around the world."

describe("Bounds.forText (measurement kernel)", () => {
    bench("short label", () => {
        Bounds.forText(shortLabel, { fontSize: 12 })
    })

    bench("long title", () => {
        Bounds.forText(longTitle, { fontSize: 16 })
    })
})

describe("TextWrap.lines (word wrapping)", () => {
    // TextWrap memoizes its computed getters, so build a fresh instance per
    // iteration and then read `lines` to trigger the wrapping.
    bench("wrap a title to 320px", () => {
        keep(
            new TextWrap({ text: longTitle, maxWidth: 320, fontSize: 16 }).lines
        )
    })

    bench("wrap a paragraph to 400px", () => {
        keep(
            new TextWrap({ text: paragraph, maxWidth: 400, fontSize: 14 }).lines
        )
    })
})

describe("shortenWithEllipsis (binary-search truncation)", () => {
    bench("truncate a title to 200px", () => {
        shortenWithEllipsis(longTitle, 200, { fontSize: 16 })
    })
})
