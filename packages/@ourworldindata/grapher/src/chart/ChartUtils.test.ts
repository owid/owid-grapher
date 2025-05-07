import { expect, it, describe } from "vitest"
import { OwidTable } from "@ourworldindata/core-table"
import { findStartTimeForSlopeChart } from "./ChartUtils"

describe(findStartTimeForSlopeChart, () => {
    it("returns the original start time when all entities have data for it", () => {
        const csv = `
            entityName,gdp,time
            USA,100,2000
            USA,110,2002
            USA,120,2005
            Germany,180,2000
            Germany,200,2002
            Germany,220,2005
            France,150,2000
            France,160,2002
            France,170,2005
        `
        const table = new OwidTable(csv)

        const startTime = findStartTimeForSlopeChart(table, ["gdp"], 2000, 2005)
        expect(startTime).toBe(2000)
    })

    it("finds a time for which all entities have data", () => {
        const csv = `
            entityName,gdp,time
            USA,100,2000
            USA,110,2002
            USA,120,2005
            Germany,200,2002
            Germany,220,2005
            France,150,2000
            France,120,2002
            France,160,2003
            France,170,2005
        `
        const table = new OwidTable(csv)

        const startTime = findStartTimeForSlopeChart(table, ["gdp"], 2000, 2005)
        expect(startTime).toBe(2002)
    })

    it("finds a time for which most entities have data", () => {
        const csv = `
            entityName,gdp,time
            USA,100,2000
            USA,110,2002
            USA,120,2005
            Germany,200,2002
            Germany,220,2005
            France,160,2003
            France,170,2005
        `
        const table = new OwidTable(csv)

        const startTime = findStartTimeForSlopeChart(table, ["gdp"], 2000, 2005)
        expect(startTime).toBe(2002)
    })

    it("handles multiple column slugs correctly", () => {
        const csv = `
            entityName,gdp,population,time
            USA,,3,2000
            USA,110,4,2002
            USA,120,8,2005
            Germany,200,2,2002
            Germany,220,,2005
            France,160,1,2003
            France,170,4,2005
        `
        const table = new OwidTable(csv)

        const startTime = findStartTimeForSlopeChart(
            table,
            ["gdp", "population"],
            2000,
            2005
        )

        // in 2002, three lines can be plotted (2x USA + 1x Germany),
        // which is more than in 2000 (1) and 2003 (2)
        expect(startTime).toBe(2002)
    })

    it("handles tables with a single year gracefully", () => {
        const csv = `
            entityName,gdp,time
            USA,120,2005
            Germany,220,2005
            France,170,2005
        `
        const table = new OwidTable(csv)

        const startTime = findStartTimeForSlopeChart(table, ["gdp"], 2005, 2005)
        expect(startTime).toBe(2005)
    })
})
