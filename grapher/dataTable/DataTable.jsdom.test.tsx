#! /usr/bin/env jest

import React from "react"

import { DataTable } from "./DataTable.js"
import { Grapher } from "../core/Grapher.js"
import { ChartTypeName, GrapherTabOption } from "../core/GrapherConstants.js"
import {
    childMortalityGrapher,
    IncompleteDataTable,
} from "./DataTable.sample.js"

import enzyme from "enzyme"
import Adapter from "enzyme-adapter-react-16"
enzyme.configure({ adapter: new Adapter() })

describe("when you render a table", () => {
    let view: enzyme.ReactWrapper
    beforeAll(() => {
        const grapher = childMortalityGrapher()
        view = enzyme.mount(<DataTable manager={grapher} />)
    })

    it("renders a table", () => {
        expect(view.find("table.data-table")).toHaveLength(1)
    })

    it("renders a Country header", () => {
        expect(view.find("thead th.entity").text()).toContain("Country")
    })

    it("renders a variable name in header", () => {
        const cell = view.find("thead th.dimension .name")
        expect(cell.text()).toContain("Child mortality")
    })

    it("renders a unit name in header", () => {
        const cell = view.find("thead th.dimension .unit")
        expect(cell.text()).toContain("percent")
    })

    it("renders 'percent' in the column header when unit is '%'", () => {
        const cell = view.find("thead th.dimension .unit")
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
    let view: enzyme.ReactWrapper
    beforeAll(() => {
        const grapher = childMortalityGrapher({
            type: ChartTypeName.LineChart,
            tab: GrapherTabOption.table,
        })
        grapher.timelineHandleTimeBounds = [1950, 2019]

        view = enzyme.mount(<DataTable manager={grapher} />)
    })

    it("header is split into two rows", () => {
        expect(view.find("thead tr")).toHaveLength(2)
    })

    it("entity header cell spans 2 rows", () => {
        const cell = view.find("thead .entity").first()
        expect(cell.prop("rowSpan")).toBe(2)
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
        expect(cell.text()).toBe("-0.89 pp")
    })

    it("renders relative change values", () => {
        const cell = view.find("tbody .dimension-deltaRatio").first()
        expect(cell.text()).toBe("-4%")
    })
})

describe("when the table doesn't have data for all rows", () => {
    const grapher = IncompleteDataTable()
    grapher.timelineHandleTimeBounds = [2000, 2000]
    const view = enzyme.shallow(<DataTable manager={grapher} />)

    it("renders no value when data is not available for years within the tolerance", () => {
        expect(view.find("tbody .dimension").at(0).first().text()).toBe("")
    })

    it("renders a tolerance notice when data is not from targetYear", () => {
        expect(view.find(".closest-time-notice-icon").text()).toContain("2001")
    })
})

describe("when you try to hide countries", () => {
    let grapher: Grapher
    let view: enzyme.ShallowWrapper
    beforeAll(() => {
        grapher = childMortalityGrapher()
        view = enzyme.shallow(<DataTable manager={grapher} />)
    })

    it("initially renders small countries", () => {
        expect(view.find("tbody tr")).toHaveLength(2)
    })

    it("renders no small countries after filter is added", () => {
        grapher.minPopulationFilter = 1e6
        expect(view.find("tbody tr")).toHaveLength(1)
    })
})
