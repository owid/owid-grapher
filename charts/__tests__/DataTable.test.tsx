import { shallow, ShallowWrapper } from "enzyme"
import * as React from "react"
import * as fixtures from "test/fixtures"

import { ChartConfig, ChartConfigProps } from "../ChartConfig"
import { DataTable } from "../DataTable"

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

        it("renders a variable header", () => {
            const cell = view.find("thead th.dimension")
            expect(cell.text()).toBe("Child mortality")
        })

        it("renders a row for each country", () => {
            expect(view.find("tbody tr")).toHaveLength(224)
        })

        it("renders the name of each country", () => {
            const cell = view.find("tbody tr td.entity").first()
            expect(cell.text()).toBe("Andorra")
        })

        it("renders the value for each country", () => {
            const cell = view.find("tbody tr td.dimension").first()
            expect(cell.text()).toBe("0.21%")
        })
    })

    describe("when the table doesn't have data for all rows", () => {
        beforeAll(() => {
            const chart = setupChart(792, 3512)
            view = shallow(<DataTable chart={chart} />)
        })

        it("omits empty rows", () => {
            expect(view.find("tbody tr")).toHaveLength(13)
        })

        it("renders data in every row", () => {
            const cells = view.find("tbody tr td.dimension")
            const texts = cells.map(td => td.text())
            expect(texts.filter(v => v.length === 0)).toHaveLength(0)
        })
    })
})
