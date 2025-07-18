/**
 * @vitest-environment jsdom
 */

import { expect, it, describe, beforeAll, beforeEach } from "vitest"
import { render } from "@testing-library/react"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
} from "@ourworldindata/types"
import {
    childMortalityGrapher,
    GrapherWithIncompleteData,
    GrapherWithMultipleVariablesAndMultipleYears,
} from "./DataTable.sample"
import { LifeExpectancyGrapher } from "../testData/OwidTestData.sample.js"
import { DataTable } from "./DataTable.js"

describe("when you render a table", () => {
    let container: HTMLElement
    beforeEach(() => {
        const grapher = childMortalityGrapher()
        const result = render(<DataTable manager={grapher} />)
        container = result.container
    })

    it("renders a table", () => {
        expect(container.querySelector("table")).toBeTruthy()
    })

    it("renders a Country header", () => {
        expect(
            container.querySelector("thead th.entity")?.textContent
        ).toContain("Country")
    })

    it("renders a variable name in the caption", () => {
        const cell = container.querySelector(".DataTable .caption")
        expect(cell?.textContent).toContain("Child mortality")
    })

    it("renders a unit name in the caption", () => {
        const cell = container.querySelector(".DataTable .caption .unit")
        expect(cell?.textContent).toContain("percent")
    })

    it("renders 'percent' in the caption when unit is '%'", () => {
        const cell = container.querySelector(".DataTable .caption .unit")
        expect(cell?.textContent).toContain("percent")
    })

    it("renders a row for each country", () => {
        expect(container.querySelectorAll("tbody tr")).toHaveLength(2)
    })

    it("renders the name of each country", () => {
        const cell = container.querySelector("tbody tr td.entity")
        expect(cell?.textContent).toBe("Afghanistan")
    })

    it("renders the value for each country", () => {
        const cell = container.querySelector("tbody tr td.cell-single")
        expect(cell?.textContent).toBe("21.56%")
    })

    it("renders the unit in cell values when the unit is '%'", () => {
        const cell = container.querySelector("tbody tr td.cell-single")
        expect(cell?.textContent).toContain("%")
    })
})

describe("when you select a range of years", () => {
    let container: HTMLElement
    beforeEach(() => {
        const grapher = childMortalityGrapher({
            chartTypes: [GRAPHER_CHART_TYPES.LineChart],
            tab: GRAPHER_TAB_CONFIG_OPTIONS.table,
        })
        grapher.timelineHandleTimeBounds = [1950, 2019]

        const result = render(<DataTable manager={grapher} />)
        container = result.container
    })

    it("renders start values", () => {
        const cell = container.querySelector("tbody .cell-start")
        expect(cell?.textContent).toBe("22.45%")
    })

    it("renders end values", () => {
        const cell = container.querySelector("tbody .cell-end")
        expect(cell?.textContent).toBe("21.56%")
    })

    it("renders absolute change values", () => {
        const cell = container.querySelector("tbody .cell-delta")
        expect(cell?.textContent).toBe("-0.89\u00a0pp") // uses no-break space separator
    })

    it("renders relative change values", () => {
        const cell = container.querySelector("tbody .cell-deltaRatio")
        expect(cell?.textContent).toBe("-4%")
    })
})

describe("when the table doesn't have data for all rows", () => {
    let container: HTMLElement
    beforeEach(() => {
        const grapher = GrapherWithIncompleteData()
        grapher.timelineHandleTimeBounds = [2000, 2000]
        const result = render(<DataTable manager={grapher} />)
        container = result.container
    })

    it("renders no value when data is not available for years within the tolerance", () => {
        expect(
            container.querySelectorAll("tbody .cell-single")[0]?.textContent
        ).toBe("")
    })

    it("renders an info icon when data is not from targetYear", () => {
        const toleranceNotices = container.querySelectorAll(
            ".closest-time-notice-icon"
        )
        expect(toleranceNotices.length).toBe(2)
    })

    it("renders a data value for the column with targetTime 2010", () => {
        expect(
            container.querySelectorAll("tbody .cell-single")[1]?.textContent
        ).toBe("20.00%")
    })

    it("displays correct targetTime for columns", () => {
        const timeHeaders = container.querySelectorAll("thead .dimension .time")
        expect(timeHeaders.length).toBe(2)
        expect(timeHeaders[0]?.textContent).toBe("2000")
        expect(timeHeaders[1]?.textContent).toBe("2010")
    })
})

describe("when the table has multiple variables and multiple years", () => {
    let container: HTMLElement
    beforeAll(() => {
        const grapher = GrapherWithMultipleVariablesAndMultipleYears()
        const result = render(<DataTable manager={grapher} />)
        container = result.container
    })

    it("header is split into two rows", () => {
        expect(container.querySelectorAll("thead tr")).toHaveLength(2)
    })
})

describe("when the table has no filter toggle", () => {
    it("does not filter by default if we have a map tab", () => {
        const grapher = LifeExpectancyGrapher({
            selectedEntityNames: ["World"],
            hideEntityControls: true, // no filter toggle
            hasMapTab: true,
        })
        const { container } = render(<DataTable manager={grapher} />)
        const rows = container.querySelectorAll("tbody tr:not(.title)")
        expect(rows).toHaveLength(grapher.availableEntityNames.length)
    })

    it("does not filter by default if the selection is empty", () => {
        const grapher = LifeExpectancyGrapher({
            selectedEntityNames: [],
            hideEntityControls: true, // no filter toggle
            hasMapTab: false,
        })
        const { container } = render(<DataTable manager={grapher} />)
        const rows = container.querySelectorAll("tbody tr:not(.title)")
        expect(rows).toHaveLength(grapher.availableEntityNames.length)
    })
})
