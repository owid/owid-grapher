#! /usr/bin/env yarn jest

import * as React from "react"
import { shallow, ShallowWrapper, mount, ReactWrapper } from "enzyme"

import { setupGrapher } from "grapher/test/utils"

import { DataTable, ClosestYearNotice } from "./DataTable"
import { Grapher } from "grapher/core/Grapher"

const getGrapher = (props: any = {}) =>
    new Grapher({
        hasMapTab: true,
        tab: "map",
        dimensions: [
            {
                variableId: 104402,
                property: "y",
            },
        ],
        ...props,
        owidDataset: {
            variables: {
                "104402": {
                    years: [1950, 1950, 2005, 2005, 2019, 2019],
                    entities: [15, 207, 15, 207, 15, 207],
                    values: [224.45, 333.68, 295.59, 246.12, 215.59, 226.12],
                    id: 104402,
                    display: {
                        name: "Child mortality",
                        unit: "%",
                        shortUnit: "%",
                        conversionFactor: 0.1,
                    },
                },
            },
            entityKey: {
                "15": { name: "Afghanistan", id: 15 },
                "207": { name: "Iceland", id: 207 },
            },
        },
    })

describe(DataTable, () => {
    describe("when you render a table", () => {
        let view: ReactWrapper
        beforeAll(() => {
            const grapher = getGrapher()
            view = mount(<DataTable grapher={grapher} />)
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
            const grapher = getGrapher({
                type: "LineChart",
                tab: "chart",
                minTime: 1990,
                maxTime: 2017,
            })
            view = mount(<DataTable grapher={grapher} />)
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
            expect(cell.text()).toBe("29.56% in 2005")
        })

        it("renders end values", () => {
            const cell = view.find("tbody .dimension-end").first()
            expect(cell.text()).toBe("21.56% in 2019")
        })

        it("renders absolute change values", () => {
            const cell = view.find("tbody .dimension-delta").first()
            expect(cell.text()).toBe("-8.00 pp")
        })

        it("renders relative change values", () => {
            const cell = view.find("tbody .dimension-deltaRatio").first()
            expect(cell.text()).toBe("-27%")
        })
    })

    describe("when the table doesn't have data for all rows", () => {
        let view: ShallowWrapper
        beforeAll(() => {
            const chart = setupGrapher(792, [3512])
            view = shallow(<DataTable grapher={chart} />)
        })

        it("renders no value when data is not available for years within the tolerance", () => {
            const cell = view.find("tbody .dimension").at(1).first()
            expect(cell.text()).toBe("")
        })

        it("renders a tolerance notice when data is not from targetYear", () => {
            const notice = view
                .find("tbody tr td.dimension")
                .first()
                .find(ClosestYearNotice)
            expect(notice.prop("closestYear")).toBe("2013")
            expect(notice.prop("targetYear")).toBe("2016")
        })
    })

    describe("when you try to hide countries", () => {
        let grapher: Grapher
        let view: ShallowWrapper
        beforeAll(() => {
            grapher = getGrapher()
            view = shallow(<DataTable grapher={grapher} />)
        })

        it("initially renders small countries", () => {
            expect(view.find("tbody tr")).toHaveLength(2)
        })

        it("renders no small countries after filter is added", () => {
            grapher.toggleMinPopulationFilter()
            expect(view.find("tbody tr")).toHaveLength(1)
        })
    })
})
