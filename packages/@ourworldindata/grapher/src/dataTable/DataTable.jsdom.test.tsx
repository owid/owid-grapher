#! /usr/bin/env jest

import React from "react"

import { DataTable } from "./DataTable"
import { ChartTypeName, GrapherTabOption } from "@ourworldindata/types"
import {
    childMortalityGrapher,
    IncompleteDataTable,
    DataTableWithAggregates,
    DataTableWithMultipleVariablesAndMultipleYears,
} from "./DataTable.sample"

import Enzyme, { ReactWrapper } from "enzyme"
import Adapter from "@wojtekmaj/enzyme-adapter-react-17"
Enzyme.configure({ adapter: new Adapter() })

describe("when you render a table", () => {
    let view: ReactWrapper
    beforeAll(() => {
        const grapher = childMortalityGrapher()
        view = Enzyme.mount(<DataTable manager={grapher} />)
    })

    it("renders a table", () => {
        expect(view.find("table")).toHaveLength(1)
    })

    it("renders a Country header", () => {
        expect(view.find("thead th.entity").text()).toContain("Country")
    })

    it("renders a variable name in the caption", () => {
        const cell = view.find(".DataTable .caption")
        expect(cell.text()).toContain("Child mortality")
    })

    it("renders a unit name in the caption", () => {
        const cell = view.find(".DataTable .caption .unit")
        expect(cell.text()).toContain("percent")
    })

    it("renders 'percent' in the caption when unit is '%'", () => {
        const cell = view.find(".DataTable .caption .unit")
        expect(cell.text()).toContain("percent")
    })

    it("renders a row for each country", () => {
        expect(view.find("tbody tr")).toHaveLength(2)
    })

    it("renders the name of each country", () => {
        const cell = view.find("tbody tr td.entity").first()
        expect(cell.text()).toBe("Afghanistan")
    })

    it("renders the value for each country", () => {
        const cell = view.find("tbody tr td.dimension").first()
        expect(cell.text()).toBe("21.56%")
    })

    it("renders the unit in cell values when the unit is '%'", () => {
        const cell = view.find("tbody tr td.dimension").first()
        expect(cell.text()).toContain("%")
    })
})

describe("when you select a range of years", () => {
    let view: ReactWrapper
    beforeAll(() => {
        const grapher = childMortalityGrapher({
            type: ChartTypeName.LineChart,
            tab: GrapherTabOption.table,
        })
        grapher.timelineHandleTimeBounds = [1950, 2019]

        view = Enzyme.mount(<DataTable manager={grapher} />)
    })

    it("renders start values", () => {
        const cell = view.find("tbody .dimension-start").first()
        expect(cell.text()).toBe("22.45%")
    })

    it("renders end values", () => {
        const cell = view.find("tbody .dimension-end").first()
        expect(cell.text()).toBe("21.56%")
    })

    it("renders absolute change values", () => {
        const cell = view.find("tbody .dimension-delta").first()
        expect(cell.text()).toBe("-0.89\u00a0pp") // uses no-break space separator
    })

    it("renders relative change values", () => {
        const cell = view.find("tbody .dimension-deltaRatio").first()
        expect(cell.text()).toBe("-4%")
    })
})

describe("when the table doesn't have data for all rows", () => {
    const grapher = IncompleteDataTable()
    grapher.timelineHandleTimeBounds = [2000, 2000]
    const view = Enzyme.mount(<DataTable manager={grapher} />)

    it("renders no value when data is not available for years within the tolerance", () => {
        expect(view.find("tbody .dimension").at(0).first().text()).toBe("")
    })

    it("renders an info icon when data is not from targetYear", () => {
        const toleranceNotices = view.find(".closest-time-notice-icon")
        expect(toleranceNotices.length).toBe(2)
    })

    it("renders a data value for the column with targetTime 2010", () => {
        expect(view.find("tbody .dimension").at(1).first().text()).toBe(
            "20.00%"
        )
    })

    it("displays correct targetTime for columns", () => {
        const timeHeaders = view.find("thead .dimension .time")
        expect(timeHeaders.length).toBe(2)
        expect(timeHeaders.at(0).text()).toBe("2000")
        expect(timeHeaders.at(1).text()).toBe("2010")
    })
})

describe("when the table has aggregates", () => {
    let view: ReactWrapper
    beforeAll(() => {
        const grapher = DataTableWithAggregates()
        view = Enzyme.mount(<DataTable manager={grapher} />)
    })

    it("renders a separating title row for aggregates", () => {
        const titleRows = view.find("tbody .title")
        expect(titleRows).toHaveLength(1)
        expect(titleRows.at(0).text()).toBe("Other")
    })
})

describe("when the table has multiple variables and multiple years", () => {
    let view: ReactWrapper
    beforeAll(() => {
        const grapher = DataTableWithMultipleVariablesAndMultipleYears()
        view = Enzyme.mount(<DataTable manager={grapher} />)
    })

    it("header is split into two rows", () => {
        expect(view.find("thead tr")).toHaveLength(2)
    })
})
