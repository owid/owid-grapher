import * as React from "react"
import { shallow, ShallowWrapper } from "enzyme"

import { DataTable } from "../DataTable"
import { ChartConfig, ChartConfigProps } from "../ChartConfig"
import * as fixtures from "test/fixtures"

function setupChart(id: number, varId: number) {
    const props = new ChartConfigProps(fixtures.readChart(id))
    const chart = new ChartConfig(props)
    chart.vardata.receiveData(fixtures.readVariable(varId))
    return chart
}

describe(DataTable, () => {
    let view: ShallowWrapper

    describe("when you render a table", () => {
        beforeAll(() => {
            const chart = setupChart(677, 104402)
            view = shallow(<DataTable chart={chart} />)
        })

        it("renders a table", () => {
            expect(view.find("table.data-table")).toHaveLength(1)
        })

        it("renders a Country header", () => {
            expect(view.find("thead th.entity").text()).toBe("Country")
        })

        it("renders a variable name in header", () => {
            const cell = view.find("thead th.dimension .name")
            expect(cell.text()).toContain("Child mortality")
        })

        it("renders a unit name in header", () => {
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

        test.todo("renders the unit next to the value when the unit is '%'")
        test.todo("renders start and end values if a range is selected")
        test.todo("renders the unit in the header when it isn't '%'")
    })

    describe("when the table doesn't have data for all rows", () => {
        beforeAll(() => {
            const chart = setupChart(792, 3512)
            view = shallow(<DataTable chart={chart} />)
        })

        it("renders data in every row", () => {
            const cells = view.find("tbody tr td.dimension")
            const texts = cells.map(td => td.text())
            expect(texts.filter(v => v.length === 0)).toHaveLength(0)
        })

        test.todo("renders the closest value within the specified tolerance")
        test.todo(
            "fades out rows that don't have data or are outside the tolerance"
        )
    })
})
