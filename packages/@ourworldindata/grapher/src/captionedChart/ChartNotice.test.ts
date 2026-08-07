import { expect, it, describe } from "vitest"
import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
    GRAPHER_TAB_CONFIG_OPTIONS,
} from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"
import { GrapherState } from "../core/GrapherState"
import { CaptionedChart, StaticCaptionedChart } from "./CaptionedChart"

/**
 * The notice sits above the chart and appears only at times where tolerance
 * was actually applied to something on screen, so the chart area gives up a
 * little height in those times and takes it back in the rest.
 */
describe("the tolerance notice row", () => {
    // Germany has no 2001 value, so tolerance is applied in 2001 and in no
    // other year
    const makeTable = (): OwidTable =>
        new OwidTable(
            [
                ["entityName", "year", "gdp"],
                ["France", 2000, 100],
                ["France", 2001, 110],
                ["France", 2002, 120],
                ["Germany", 2000, 400],
                ["Germany", 2002, 420],
            ],
            [
                { slug: "gdp", type: ColumnTypeNames.Numeric, tolerance: 2 },
                { slug: "year", type: ColumnTypeNames.Year },
            ]
        )

    // the grapher's own bounds; the captioned chart reads them off the manager
    const bounds = new Bounds(0, 0, 800, 600)

    const makeGrapher = (year: number, table = makeTable()): GrapherState => {
        const grapher = new GrapherState({
            table,
            ySlugs: "gdp",
            tab: GRAPHER_TAB_CONFIG_OPTIONS.map,
            hasMapTab: true,
            map: { timeTolerance: 2 },
            bounds,
        })
        grapher.timelineHandleTimeBounds = [year, year]
        return grapher
    }

    // chartHeight is private, and it's the number this whole design protects
    const chartAreaHeight = (grapher: GrapherState): number =>
        (
            new CaptionedChart({ manager: grapher }) as any
        ).boundsForChartArea.height

    const YEARS = [2000, 2001, 2002]

    it("shows the notice only in the year tolerance is applied", () => {
        const notices = YEARS.map((year) => makeGrapher(year).toleranceNotice)
        expect(notices[0]).toBeUndefined()
        expect(notices[1]).toBeDefined()
        expect(notices[2]).toBeUndefined()
    })

    it("gives the row its height only in the year the notice shows", () => {
        const [without, with_, alsoWithout] = YEARS.map((year) =>
            chartAreaHeight(makeGrapher(year))
        )
        expect(with_).toBeLessThan(without)
        expect(alsoWithout).toEqual(without)
    })

    it("takes no height on a chart that never applies tolerance", () => {
        // every country has a value for every year
        const completeTable = new OwidTable(
            [
                ["entityName", "year", "gdp"],
                ["France", 2000, 100],
                ["France", 2001, 110],
                ["Germany", 2000, 400],
                ["Germany", 2001, 410],
            ],
            [
                { slug: "gdp", type: ColumnTypeNames.Numeric, tolerance: 2 },
                { slug: "year", type: ColumnTypeNames.Year },
            ]
        )
        const withoutNotice = makeGrapher(2001, completeTable)
        expect(withoutNotice.toleranceNotice).toBeUndefined()
        expect(chartAreaHeight(withoutNotice)).toBeGreaterThan(
            chartAreaHeight(makeGrapher(2001))
        )
    })

    it("leaves the authored note alone", () => {
        const grapher = makeGrapher(2001)
        grapher.note = "Values are adjusted."
        expect(grapher.note).toEqual("Values are adjusted.")
        expect(grapher.toleranceNotice).not.toContain("Values are adjusted.")
    })

    it("behaves the same in static exports", () => {
        const staticHeight = (year: number): number =>
            (
                new StaticCaptionedChart({
                    manager: makeGrapher(year),
                }) as any
            ).boundsForChartArea.height
        expect(staticHeight(2000)).toBeGreaterThan(staticHeight(2001))
    })
})
