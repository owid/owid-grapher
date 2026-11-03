/**
 * @vitest-environment happy-dom
 */

import { expect, it, describe, beforeAll, beforeEach, vi } from "vitest"
import { render } from "@testing-library/react"
import {
    ColumnTypeNames,
    EntitySelectionMode,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    SortOrder,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import {
    childMortalityGrapher,
    GrapherStartingAtZero,
    GrapherWithAggregates,
    GrapherWithIncompleteData,
    GrapherWithMultipleVariablesAndMultipleYears,
    GrapherWithStaggeredSeries,
} from "./DataTable.sample"
import { LifeExpectancyGrapher } from "../testData/OwidTestData.sample.js"
import { DataTable } from "./DataTable.js"
import { PointColumnKey } from "./DataTableConstants.js"
import { GrapherState } from "../core/GrapherState"

const findRow = (
    container: HTMLElement,
    entityName: string
): Element | undefined =>
    Array.from(container.querySelectorAll("tbody tr")).find(
        (tr) => tr.querySelector("td.entity")?.textContent === entityName
    )

const getCellTexts = (
    container: HTMLElement,
    entityName: string,
    cellSelector: string
): (string | null)[] =>
    Array.from(
        findRow(container, entityName)?.querySelectorAll(cellSelector) ?? [],
        (cell) => cell.textContent
    )

const getMissingValueNotices = (
    container: HTMLElement,
    entityName: string,
    cellSelector: string
): Element[] =>
    Array.from(
        findRow(container, entityName)?.querySelectorAll(
            `${cellSelector} .missing-value`
        ) ?? []
    )

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

    it("labels the sparkline column 'Trend'", () => {
        const headers = [
            ...container.querySelectorAll("thead th.subdimension"),
        ].map((header) => header.textContent)
        expect(headers).toContain("Trend")
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

describe("when entities' series start and end at different times", () => {
    it("spans each sparkline across the full cell width", () => {
        const grapher = GrapherWithStaggeredSeries()
        const { container } = render(<DataTable manager={grapher} />)

        const xCoordinatesByEntity = ["Afghanistan", "Iceland"].map(
            (entityName) => {
                const path = findRow(container, entityName)?.querySelector(
                    "svg path"
                )
                const xCoordinates = [
                    ...(path?.getAttribute("d") ?? "").matchAll(
                        /[ML]\s*(-?[\d.]+)/g
                    ),
                ].map((match) => Number(match[1]))
                return [xCoordinates.at(0), xCoordinates.at(-1)]
            }
        )

        expect(xCoordinatesByEntity[0][0]).toBeDefined()
        expect(xCoordinatesByEntity[0]).toEqual(xCoordinatesByEntity[1])
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

    it("renders a dash when data is not available for years within the tolerance", () => {
        const [value] = getCellTexts(container, "Afghanistan", ".cell-single")
        expect(value).toBe("—")
    })

    it("names the target time of a missing value", () => {
        const [notice] = getMissingValueNotices(
            container,
            "Afghanistan",
            ".cell-single"
        )
        expect(notice?.getAttribute("aria-label")).toBe("No data for 2000")
    })

    it("renders a dash for an entity with no data in the column's tolerance window", () => {
        const [, value] = getCellTexts(container, "France", ".cell-single")
        expect(value).toBe("—")
        const [notice] = getMissingValueNotices(
            container,
            "France",
            ".cell-single"
        )
        expect(notice?.getAttribute("aria-label")).toBe("No data for 2010")
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
        const timeHeaders = [
            ...container.querySelectorAll("thead th.subdimension-first"),
        ].map((header) => header.textContent)
        expect(timeHeaders).toEqual(["2000", "2010"])
    })
})

describe("when a range has no data at its start", () => {
    let container: HTMLElement
    beforeEach(() => {
        const grapher = GrapherWithIncompleteData()
        grapher.timelineHandleTimeBounds = [2000, 2010]
        const result = render(<DataTable manager={grapher} />)
        container = result.container
    })

    it("renders a dash with the start time in the start cell", () => {
        const [text] = getCellTexts(container, "Afghanistan", ".cell-start")
        expect(text).toBe("—")
        const [notice] = getMissingValueNotices(
            container,
            "Afghanistan",
            ".cell-start"
        )
        expect(notice?.getAttribute("aria-label")).toBe("No data for 2000")
    })

    it("renders plain dashes without a time in the delta cells", () => {
        for (const selector of [".cell-delta", ".cell-deltaRatio"]) {
            const [text] = getCellTexts(container, "Afghanistan", selector)
            expect(text).toBe("—")
            const [notice] = getMissingValueNotices(
                container,
                "Afghanistan",
                selector
            )
            expect(notice?.getAttribute("aria-label")).toBe("No data")
        }
    })
})

describe("when a range starts at zero", () => {
    it("renders a dash in the relative change cell", () => {
        const grapher = GrapherStartingAtZero()
        grapher.timelineHandleTimeBounds = [2000, 2010]
        const { container } = render(<DataTable manager={grapher} />)

        const [text] = getCellTexts(container, "Iceland", ".cell-deltaRatio")
        expect(text).toBe("—")
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

describe("when the table shows a single year with sparklines for multiple variables", () => {
    let container: HTMLElement
    beforeAll(() => {
        const grapher = GrapherWithMultipleVariablesAndMultipleYears()
        grapher.timelineHandleTimeBounds = [2019, 2019]
        const result = render(<DataTable manager={grapher} />)
        container = result.container
    })

    it("names the year in the subheader only", () => {
        const subheaders = [
            ...container.querySelectorAll("thead th.subdimension"),
        ].map((header) => header.textContent)
        expect(subheaders).toEqual(["2019", "Trend", "2019", "Trend"])

        const headers = [...container.querySelectorAll("thead th.dimension")]
        expect(headers).toHaveLength(2)
        for (const header of headers)
            expect(header.textContent).not.toContain("2019")
    })
})

describe("when the table shows a single column for each of multiple variables", () => {
    it("names the year in the variable header", () => {
        const grapher = GrapherWithMultipleVariablesAndMultipleYears({
            timelineMinTime: 2019,
            timelineMaxTime: 2019,
        })
        const { container } = render(<DataTable manager={grapher} />)

        expect(container.querySelectorAll("thead tr")).toHaveLength(1)
        const timeHeaders = [
            ...container.querySelectorAll("thead .dimension .time"),
        ].map((header) => header.textContent)
        expect(timeHeaders).toEqual(["2019", "2019"])
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
        expect(getEntityNames(container)).toContain("France")
    })

    it("does not filter by selection by default if the selection is empty", () => {
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

    it("shows all entities if the table is narrowed to a selection of mostly countries", () => {
        const grapher = LifeExpectancyGrapher({
            selectedEntityNames: ["France", "China", "Europe"],
            addCountryMode: EntitySelectionMode.Disabled,
            hasMapTab: false,
            tab: GRAPHER_TAB_CONFIG_OPTIONS.table,
        })
        const { container } = render(<DataTable manager={grapher} />)
        expect(grapher.dataTableFilter).toBe("all")
        expect(getEntityNames(container).sort()).toEqual([
            "China",
            "Europe",
            "France",
        ])
    })

    it("shows only countries if the reader picks them for a narrowed table", () => {
        const grapher = LifeExpectancyGrapher({
            selectedEntityNames: ["France", "China", "Europe"],
            addCountryMode: EntitySelectionMode.Disabled,
            hasMapTab: false,
            tab: GRAPHER_TAB_CONFIG_OPTIONS.table,
        })
        grapher.populateFromQueryParams({ tableFilter: "countries" })
        const { container } = render(<DataTable manager={grapher} />)
        expect(getEntityNames(container).sort()).toEqual(["China", "France"])
    })

    it("shows only countries even if the selection covers every entity", () => {
        const grapher = GrapherWithAggregates({
            selectedEntityNames: ["Afghanistan", "Iceland", "World"],
        })
        const { container } = render(<DataTable manager={grapher} />)
        expect(grapher.dataTableFilter).toBe("countries")
        expect(getEntityNames(container).sort()).toEqual([
            "Afghanistan",
            "Iceland",
        ])
    })

    it("filters by the map selection if there is one", () => {
        const grapher = GrapherWithAggregates()
        grapher.mapConfig.selection.setSelectedEntities(["Iceland"])
        grapher.dataTableConfig.filter = "selection"
        const { container } = render(<DataTable manager={grapher} />)
        expect(getEntityNames(container)).toEqual(["Iceland"])
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

    it("searches all entities if the URL has a search but no filter", () => {
        const grapher = GrapherWithAggregates()
        grapher.populateFromQueryParams({ tableSearch: "World" })
        const { container } = render(<DataTable manager={grapher} />)
        expect(getEntityNames(container)).toEqual(["World"])
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

describe("when a scatter's colour column has a single observation", () => {
    it("shows the colour value in years without an observation", () => {
        const table = new OwidTable(
            [
                ["entityName", "year", "x", "y", "color"],
                ["France", 2021, 1, 1, null],
                ["France", 2022, 2, 2, null],
                ["France", 2023, null, 3, "Europe"],
            ],
            [
                { slug: "x", type: ColumnTypeNames.Numeric },
                { slug: "y", type: ColumnTypeNames.Numeric },
                { slug: "color", type: ColumnTypeNames.String },
            ]
        )
        const grapher = new GrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.ScatterPlot],
            xSlug: "x",
            ySlugs: "y",
            colorSlug: "color",
            table,
            tab: GRAPHER_TAB_CONFIG_OPTIONS.table,
        })
        grapher.timelineHandleTimeBounds = [2022, 2022]
        const { container } = render(<DataTable manager={grapher} />)

        expect(getCellTexts(container, "France", ".cell-single")).toContain(
            "Europe"
        )
    })
})

describe("when the table is sorted by an ordinal column", () => {
    const renderSortedByMonth = (order: SortOrder): (string | null)[] => {
        const table = new OwidTable(
            [
                ["entityName", "year", "month"],
                ["Brazil", 2020, "Mar"],
                ["Chad", 2020, "Jan"],
                ["Denmark", 2020, "Apr"],
                ["Egypt", 2020, "Feb"],
                ["Fiji", 2010, "Jan"],
            ],
            [
                {
                    slug: "month",
                    type: ColumnTypeNames.Ordinal,
                    sort: ["Jan", "Feb", "Mar", "Apr"],
                },
            ]
        )
        const grapher = new GrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
            ySlugs: "month",
            table,
            tab: GRAPHER_TAB_CONFIG_OPTIONS.table,
        })
        grapher.dataTableSort = {
            dimIndex: 0,
            columnKey: PointColumnKey.single,
            order,
        }
        const { container } = render(<DataTable manager={grapher} />)
        return getEntityNames(container)
    }

    it("sorts ascending by the column's sort order rather than alphabetically", () => {
        expect(renderSortedByMonth(SortOrder.asc)).toEqual([
            "Chad",
            "Egypt",
            "Brazil",
            "Denmark",
            "Fiji",
        ])
    })

    it("sorts descending by the reverse of the column's sort order", () => {
        expect(renderSortedByMonth(SortOrder.desc)).toEqual([
            "Denmark",
            "Brazil",
            "Egypt",
            "Chad",
            "Fiji",
        ])
    })
})
