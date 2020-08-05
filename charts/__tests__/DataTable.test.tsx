#! /usr/bin/env yarn jest

import * as React from "react"
import { shallow, ShallowWrapper, mount, ReactWrapper } from "enzyme"

import { setupChart } from "test/utils"

import { DataTable, ClosestYearNotice } from "../DataTable"

describe(DataTable, () => {
    describe("when you render a table", () => {
        let view: ReactWrapper
        beforeAll(() => {
            const chart = setupChart(677, [104402])
            view = mount(<DataTable chart={chart} />)
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
            expect(view.find("tbody tr")).toHaveLength(224)
        })

        it("renders the name of each country", () => {
            const cell = view.find("tbody tr td.entity").first()
            expect(cell.text()).toBe("Afghanistan")
        })

        it("renders the value for each country", () => {
            const cell = view.find("tbody tr td.dimension").first()
            expect(cell.text()).toBe("5.58%")
        })

        it("renders the unit in cell values when the unit is '%'", () => {
            const cell = view.find("tbody tr td.dimension").first()
            expect(cell.text()).toContain("%")
        })
    })

    describe("when you select a range of years", () => {
        let view: ReactWrapper
        beforeAll(() => {
            const chart = setupChart(677, [104402], {
                type: "LineChart",
                tab: "chart",
                minTime: 1990,
                maxTime: 2017
            })
            view = mount(<DataTable chart={chart} />)
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
            expect(cell.text()).toBe("14.76% in 1990")
        })

        it("renders end values", () => {
            const cell = view.find("tbody .dimension-end").first()
            expect(cell.text()).toBe("5.58% in 2017")
        })

        it("renders absolute change values", () => {
            const cell = view.find("tbody .dimension-delta").first()
            expect(cell.text()).toBe("-9.18 pp")
        })

        it("renders relative change values", () => {
            const cell = view.find("tbody .dimension-deltaRatio").first()
            expect(cell.text()).toBe("-62%")
        })
    })

    describe("when the table doesn't have data for all rows", () => {
        let view: ShallowWrapper
        beforeAll(() => {
            const chart = setupChart(792, [3512])
            view = shallow(<DataTable chart={chart} />)
        })

        it("renders no value when data is not available for years within the tolerance", () => {
            const cell = view
                .find("tbody .dimension")
                .at(1)
                .first()
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
        let view: ShallowWrapper
        beforeAll(() => {
            const chart = setupChart(677, [104402], {
                minPopulationFilter: 1e6
            })

            view = shallow(<DataTable chart={chart} />)
        })

        it("renders no small countries", () => {
            expect(view.find("tbody tr")).toHaveLength(187)
        })
    })
})
