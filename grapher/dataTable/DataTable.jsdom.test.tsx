#! /usr/bin/env yarn jest

import * as React from "react"
import { shallow, ShallowWrapper, mount, ReactWrapper } from "enzyme"
import { DataTable } from "./DataTable"
import { Grapher } from "grapher/core/Grapher"
import {
    ChartTypeName,
    DimensionProperty,
    GrapherTabOption,
} from "grapher/core/GrapherConstants"
import { childMortalityGrapher } from "./DataTable.sample"

describe("when you render a table", () => {
    let view: ReactWrapper
    beforeAll(() => {
        const grapher = childMortalityGrapher()
        view = mount(<DataTable manager={grapher} />)
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
    let view: ReactWrapper
    beforeAll(() => {
        const grapher = childMortalityGrapher({
            type: ChartTypeName.LineChart,
            tab: GrapherTabOption.chart,
        })
        grapher.startTime = 1950
        grapher.endTime = 2019

        view = mount(<DataTable manager={grapher} />)
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
        expect(cell.text()).toBe("22.45% in 1950")
    })

    it("renders end values", () => {
        const cell = view.find("tbody .dimension-end").first()
        expect(cell.text()).toBe("21.56% in 2019")
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
    const grapher = new Grapher({
        dimensions: [
            {
                variableId: 3512,
                property: DimensionProperty.y,
                display: {
                    name: "",
                    unit: "% of children under 5",
                    tolerance: 1,
                    isProjection: false,
                },
            },
        ],
        owidDataset: {
            variables: {
                "3512": {
                    years: [2000, 2001, 2010, 2010],
                    entities: [207, 33, 15, 207],
                    values: [4, 22, 20, 34],
                    id: 3512,
                    shortUnit: "%",
                },
            },
            entityKey: {
                "15": { name: "Afghanistan", id: 15, code: "AFG" },
                "207": { name: "Iceland", id: 207, code: "ISL" },
                "33": { name: "France", id: 33, code: "FRA" },
            },
        },
    })
    grapher.startTime = 2000
    grapher.endTime = 2000
    const view: ShallowWrapper = shallow(<DataTable manager={grapher} />)

    // Todo: added stories for these. Need to fix these tests.
    it("renders no value when data is not available for years within the tolerance", () => {
        expect(view.find("tbody .dimension").at(0).first().text()).toBe("")
    })

    it("renders a tolerance notice when data is not from targetYear", () => {
        expect(view.find(".closest-time-notice-icon").text()).toContain("2000")
    })
})

describe("when you try to hide countries", () => {
    let grapher: Grapher
    let view: ShallowWrapper
    beforeAll(() => {
        grapher = childMortalityGrapher()
        view = shallow(<DataTable manager={grapher} />)
    })

    it("initially renders small countries", () => {
        expect(view.find("tbody tr")).toHaveLength(2)
    })

    // Todo: this one should be easy to fix, we just need to decide where we want filtering to happen
    it("renders no small countries after filter is added", () => {
        grapher.toggleMinPopulationFilter()
        expect(view.find("tbody tr")).toHaveLength(1)
    })
})
