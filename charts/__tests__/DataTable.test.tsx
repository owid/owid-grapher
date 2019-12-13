import * as React from "react"
import { shallow, ShallowWrapper } from "enzyme"
import * as fs from "fs"

import { DataTable } from "../DataTable"
import { ChartConfig, ChartConfigProps } from "../ChartConfig"
import { extend } from "charts/Util"

function readFixture(fixture: string) {
    const buffer = fs.readFileSync(`test/fixtures/${fixture}.json`)
    return JSON.parse(buffer.toString())
}

const chartFixture = readFixture("chart-677")
const variableFixture = readFixture("variable-104402")

describe(DataTable, () => {
    const props = new ChartConfigProps()
    let chart: ChartConfig

    beforeAll(() => {
        extend(props, chartFixture)
        chart = new ChartConfig(props)
        chart.vardata.receiveData(variableFixture)
    })

    describe("when you render a table", () => {
        let view: ShallowWrapper

        beforeAll(() => (view = shallow(<DataTable chart={chart} />)))

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
            expect(cell.text()).toBe("Afghanistan")
        })

        it("renders the value for each country", () => {
            const cell = view.find("tbody tr td.dimension").first()
            expect(cell.text()).toBe("5.58%")
        })
    })
})
