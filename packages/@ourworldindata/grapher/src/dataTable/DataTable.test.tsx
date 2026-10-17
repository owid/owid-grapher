/**
 * @vitest-environment happy-dom
 */

import { expect, it, describe, beforeAll, beforeEach, vi } from "vitest"
import { render } from "@testing-library/react"
import {
    EntitySelectionMode,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    SortOrder,
} from "@ourworldindata/types"
import {
    childMortalityGrapher,
    GrapherWithAggregates,
    GrapherWithIncompleteData,
    GrapherWithMultipleVariablesAndMultipleYears,
} from "./DataTable.sample"
import { LifeExpectancyGrapher } from "../testData/OwidTestData.sample.js"
import { DataTable } from "./DataTable.js"
import { PointColumnKey } from "./DataTableConstants.js"

const getCellTexts = (
    container: HTMLElement,
    entityName: string,
    cellSelector: string
): (string | null)[] => {
    const row = Array.from(container.querySelectorAll("tbody tr")).find(
        (tr) => tr.querySelector("td.entity")?.textContent === entityName
    )
    return Array.from(
        row?.querySelectorAll(cellSelector) ?? [],
        (cell) => cell.textContent
    )
}

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
        const cell = container.querySelector(".DataTable .caption")
        expect(cell?.textContent).toContain("percent")
    })

    it("renders 'percent' in the caption when unit is '%'", () => {
        const cell = container.querySelector(".DataTable .caption")
        expect(cell?.textContent).toContain("percent")
    })

    it("renders a row for each country", () => {
        expect(container.querySelectorAll("tbody tr")).toHaveLength(2)
    })

    it("renders the name of each country", () => {
        const names = Array.from(
            container.querySelectorAll("tbody tr td.entity"),
            (cell) => cell.textContent
        )
        expect(names).toContain("Afghanistan")
    })

    it("renders the value for each country", () => {
        const values = Array.from(
            container.querySelectorAll("tbody tr td.cell-single"),
            (cell) => cell.textContent
        )
        expect(values).toContain("21.56%")
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
        const [text] = getCellTexts(container, "Afghanistan", ".cell-start")
        expect(text).toBe("22.45%")
    })

    it("renders end values", () => {
        const [text] = getCellTexts(container, "Afghanistan", ".cell-end")
        expect(text).toBe("21.56%")
    })

    it("renders absolute change values", () => {
        const [text] = getCellTexts(container, "Afghanistan", ".cell-delta")
        expect(text).toBe("-0.89\u00a0pp")
    })

    it("renders relative change values", () => {
        const [text] = getCellTexts(
            container,
            "Afghanistan",
            ".cell-deltaRatio"
        )
        expect(text).toBe("-4%")
    })

    it("labels the sparkline column with the time range", () => {
        const headers = [
            ...container.querySelectorAll("thead th.subdimension"),
        ].map((header) => header.textContent)
        expect(headers).toContain("1950 to 2019")
    })
})

describe("when the table is sorted by a single-year value but shows a range", () => {
    it("sorts by the end of the range rather than its start", () => {
        const grapher = childMortalityGrapher({
            chartTypes: [GRAPHER_CHART_TYPES.LineChart],
            tab: GRAPHER_TAB_CONFIG_OPTIONS.table,
        })
        // Afghanistan is higher in 2005, Iceland in 2019
        grapher.timelineHandleTimeBounds = [2005, 2019]
        grapher.dataTableSort = {
            dimIndex: 0,
            columnKey: PointColumnKey.single,
            order: SortOrder.desc,
        }

        const { container } = render(<DataTable manager={grapher} />)

        const entities = [...container.querySelectorAll("tbody td.entity")].map(
            (cell) => cell.textContent
        )
        expect(entities).toEqual(["Iceland", "Afghanistan"])
    })
})

describe("when the stored sort points to a column that isn't shown", () => {
    it("sorts by the last shown column instead", () => {
        const grapher = childMortalityGrapher({
            chartTypes: [GRAPHER_CHART_TYPES.LineChart],
            tab: GRAPHER_TAB_CONFIG_OPTIONS.table,
        })
        // e.g. left over from a view with more indicators
        grapher.dataTableSort = {
            dimIndex: 3,
            columnKey: PointColumnKey.single,
            order: SortOrder.desc,
        }

        const { container } = render(<DataTable manager={grapher} />)

        const entities = [...container.querySelectorAll("tbody td.entity")].map(
            (cell) => cell.textContent
        )
        expect(entities).toEqual(["Iceland", "Afghanistan"])
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
        const [value] = getCellTexts(container, "Afghanistan", ".cell-single")
        expect(value).toBe("")
    })

    it("renders an info icon when data is not from targetYear", () => {
        const toleranceNotices = container.querySelectorAll(
            ".closest-time-notice-icon"
        )
        expect(toleranceNotices.length).toBe(2)
    })

    it("renders a data value for the column with targetTime 2010", () => {
        const [, value] = getCellTexts(container, "Afghanistan", ".cell-single")
        expect(value).toBe("20.00%")
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
    it("does not filter by selection by default if we have a map tab", () => {
        const grapher = LifeExpectancyGrapher({
            selectedEntityNames: ["World"],
            hideEntityControls: true, // no filter toggle
            hasMapTab: true,
        })
        const { container } = render(<DataTable manager={grapher} />)
        const rows = container.querySelectorAll("tbody tr:not(.title)")
        expect(rows).toHaveLength(3)
    })

    it("does not filter by selection by default if the selection is empty", () => {
        const grapher = LifeExpectancyGrapher({
            selectedEntityNames: [],
            hideEntityControls: true, // no filter toggle
            hasMapTab: false,
        })
        const { container } = render(<DataTable manager={grapher} />)
        const rows = container.querySelectorAll("tbody tr:not(.title)")
        expect(rows).toHaveLength(3)
    })
})

describe("when searching the table", () => {
    it("matches an entity by its name in the reader's language", () => {
        vi.spyOn(navigator, "languages", "get").mockReturnValue(["de-DE"])
        const grapher = childMortalityGrapher()
        grapher.dataTableConfig.search = "Island"
        const { container } = render(<DataTable manager={grapher} />)
        const entityNames = Array.from(
            container.querySelectorAll("tbody td.entity"),
            (cell) => cell.textContent
        )
        expect(entityNames).toEqual(["Iceland"])
    })
})

const getEntityNames = (container: HTMLElement): (string | null)[] =>
    Array.from(
        container.querySelectorAll("tbody td.entity"),
        (cell) => cell.textContent
    )

describe("when choosing the default filter", () => {
    it("shows only countries if the table also has aggregates", () => {
        const grapher = GrapherWithAggregates()
        const { container } = render(<DataTable manager={grapher} />)
        expect(grapher.dataTableFilter).toBe("countries")
        expect(getEntityNames(container).sort()).toEqual([
            "Afghanistan",
            "Iceland",
        ])
    })

    it("shows all entities if the table has no countries", () => {
        const grapher = GrapherWithMultipleVariablesAndMultipleYears()
        const { container } = render(<DataTable manager={grapher} />)
        expect(grapher.dataTableFilter).toBe("all")
        expect(getEntityNames(container)).toEqual(["World"])
    })

    it("shows all entities if the table is narrowed to a selection of aggregates", () => {
        const grapher = LifeExpectancyGrapher({
            selectedEntityNames: ["World"],
            addCountryMode: EntitySelectionMode.Disabled,
            hasMapTab: false,
            tab: GRAPHER_TAB_CONFIG_OPTIONS.table,
        })
        const { container } = render(<DataTable manager={grapher} />)
        expect(grapher.dataTableFilter).toBe("all")
        expect(getEntityNames(container)).toEqual(["World"])
    })

    it("shows all entities if the tableFilter param is 'all'", () => {
        const grapher = GrapherWithAggregates()
        grapher.populateFromQueryParams({ tableFilter: "all" })
        const { container } = render(<DataTable manager={grapher} />)
        expect(getEntityNames(container).sort()).toEqual([
            "Afghanistan",
            "Iceland",
            "World",
        ])
    })

    it("does not put the default filter in the URL", () => {
        const grapher = GrapherWithAggregates()
        expect(grapher.changedParams).not.toHaveProperty("tableFilter")
    })

    it("puts an explicit filter in the URL", () => {
        const grapher = GrapherWithAggregates()
        grapher.populateFromQueryParams({ tableFilter: "all" })
        expect(grapher.changedParams.tableFilter).toBe("all")
    })
})

describe("when choosing the default sort", () => {
    it("sorts a point table by value, largest first", () => {
        const { container } = render(
            <DataTable manager={childMortalityGrapher()} />
        )
        expect(getEntityNames(container)).toEqual(["Iceland", "Afghanistan"])
    })

    it("sorts a range table by end value, largest first", () => {
        const grapher = childMortalityGrapher({
            chartTypes: [GRAPHER_CHART_TYPES.LineChart],
            tab: GRAPHER_TAB_CONFIG_OPTIONS.table,
        })
        grapher.timelineHandleTimeBounds = [1950, 2005]
        const { container } = render(<DataTable manager={grapher} />)
        expect(getEntityNames(container)).toEqual(["Afghanistan", "Iceland"])
    })
})
