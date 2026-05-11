import { expect, it, describe } from "vitest"

import { OwidTable } from "@ourworldindata/core-table"
import { SeriesStrategy } from "@ourworldindata/types"
import { DumbbellChartState } from "./DumbbellChartState"
import {
    DECREASE_COLOR,
    INCREASE_COLOR,
    DumbbellChartManager,
} from "./DumbbellChartConstants"

describe("entity strategy", () => {
    it("constructs dumbbell series across two time points", () => {
        const csv = `gdp,year,entityName
100,2000,USA
150,2010,USA
80,2000,UK
60,2010,UK`

        const table = new OwidTable(csv)
        const manager: DumbbellChartManager = {
            table,
            selection: table.availableEntityNames,
            yColumnSlugs: ["gdp"],
        }
        const chartState = new DumbbellChartState({ manager })

        expect(chartState.errorInfo.reason).toEqual("")
        expect(chartState.series.length).toEqual(2)

        const usa = chartState.series.find((s) => s.entityName === "USA")!
        expect(usa.start.value).toEqual(100)
        expect(usa.end.value).toEqual(150)
        expect(usa.start.time).toEqual(2000)
        expect(usa.end.time).toEqual(2010)
    })

    it("colors series by direction of change", () => {
        const csv = `gdp,year,entityName
    100,2000,Riser
    150,2010,Riser
    100,2000,Faller
    50,2010,Faller`

        const table = new OwidTable(csv)
        const manager: DumbbellChartManager = {
            table,
            selection: table.availableEntityNames,
            yColumnSlugs: ["gdp"],
        }
        const chartState = new DumbbellChartState({ manager })

        const riser = chartState.series.find((s) => s.entityName === "Riser")!
        const faller = chartState.series.find((s) => s.entityName === "Faller")!

        expect(riser.color).toEqual(INCREASE_COLOR)
        expect(faller.color).toEqual(DECREASE_COLOR)
    })

    it("filters out series with missing start or end value", () => {
        const csv = `gdp,year,entityName
100,2000,Complete
150,2010,Complete
80,2000,MissingEnd`

        const table = new OwidTable(csv)
        const manager: DumbbellChartManager = {
            table,
            selection: table.availableEntityNames,
            yColumnSlugs: ["gdp"],
        }
        const chartState = new DumbbellChartState({ manager })

        expect(chartState.series.length).toEqual(1)
        expect(chartState.series[0].entityName).toEqual("Complete")
    })
})

describe("column strategy", () => {
    it("constructs series comparing two columns at one time", () => {
        const csv = `population,gdp,year,entityName
100,500,2010,USA`

        const table = new OwidTable(csv)
        const manager: DumbbellChartManager = {
            table,
            selection: table.availableEntityNames,
            yColumnSlugs: ["population", "gdp"],
            seriesStrategy: SeriesStrategy.column,
        }
        const chartState = new DumbbellChartState({ manager })

        expect(chartState.seriesStrategy).toEqual(SeriesStrategy.column)
        expect(chartState.series.length).toEqual(1)

        const series = chartState.series[0]
        expect(series.start.value).toEqual(100)
        expect(series.end.value).toEqual(500)
    })
})
