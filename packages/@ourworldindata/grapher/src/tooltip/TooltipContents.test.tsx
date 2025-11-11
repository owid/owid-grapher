/**
 * @vitest-environment happy-dom
 */

import { expect, it, describe } from "vitest"
import { render } from "@testing-library/react"
import {
    TooltipValue,
    TooltipValueRange,
    TooltipTable,
    SignificanceIcon,
    makeTooltipToleranceNotice,
    makeTooltipRoundingNotice,
    toTooltipTableColumns,
} from "./TooltipContents"
import {
    SynthesizeFruitTable,
    SampleColumnSlugs,
} from "@ourworldindata/core-table"
import { NO_DATA_LABEL } from "../color/ColorScale"
import {
    GrapherTooltipAnchor,
    OwidVariableRoundingMode,
} from "@ourworldindata/utils"
import { TooltipContext } from "./TooltipProps"

describe("TooltipValue", () => {
    const table = SynthesizeFruitTable()
    const column = table.get(SampleColumnSlugs.Fruit)

    it("renders numeric values", () => {
        const { container } = render(
            <TooltipValue
                label={column.displayName}
                unit={column.displayUnit}
                value={column.formatValueShort(42)}
                color="#ff0000"
            />
        )

        const values = container.querySelector(".values span")
        expect(values?.textContent).toBe("42")

        const definition = container.querySelector(".definition .name")
        expect(definition?.textContent).toBe("Fruit")
    })

    it("renders NO_DATA_LABEL for undefined values", () => {
        const { container } = render(
            <TooltipValue
                label={column.displayName}
                unit={column.displayUnit}
                value={column.formatValueShort(undefined)}
            />
        )

        const values = container.querySelector(".values span")
        expect(values?.textContent).toBe(NO_DATA_LABEL)
    })

    it("applies provided color for valid data", () => {
        const { container } = render(
            <TooltipValue
                label={column.displayName}
                unit={column.displayUnit}
                value={column.formatValueShort(42)}
                color="#ff0000"
            />
        )

        const values = container.querySelector(".values")
        expect(values?.getAttribute("style")).toContain("#ff0000")
    })

    it("shows significance superscript when enabled and column rounds", () => {
        const tableWithRounding = table.updateDefs((def) => {
            if (def.slug === SampleColumnSlugs.Fruit) {
                def.display = {
                    ...def.display,
                    roundingMode: OwidVariableRoundingMode.significantFigures,
                }
            }
            return def
        })
        const columnWithRounding = tableWithRounding.get(
            SampleColumnSlugs.Fruit
        )

        const { container } = render(
            <TooltipValue
                label={columnWithRounding.displayName}
                unit={columnWithRounding.displayUnit}
                value={columnWithRounding.formatValueShort(42)}
                isRoundedToSignificantFigures={true}
                showSignificanceSuperscript={true}
            />
        )

        expect(container.querySelector("div.icon-circled-s")).toBeTruthy()
    })

    it("hides significance superscript when not enabled", () => {
        const tableWithRounding = table.updateDefs((def) => {
            if (def.slug === SampleColumnSlugs.Fruit) {
                def.display = {
                    ...def.display,
                    roundingMode: OwidVariableRoundingMode.significantFigures,
                }
            }
            return def
        })
        const columnWithRounding = tableWithRounding.get(
            SampleColumnSlugs.Fruit
        )

        const { container } = render(
            <TooltipValue
                label={columnWithRounding.displayName}
                unit={columnWithRounding.displayUnit}
                value={columnWithRounding.formatValueShort(42)}
                isRoundedToSignificantFigures={true}
                showSignificanceSuperscript={false}
            />
        )

        expect(container.querySelector("div.icon-circled-s")).toBeFalsy()
    })

    it("shows projection label when isProjection is true", () => {
        const { container } = render(
            <TooltipValue
                label={column.displayName}
                unit={column.displayUnit}
                value={column.formatValueShort(42)}
                isProjection={true}
            />
        )

        expect(container.querySelector(".projection")?.textContent).toBe(
            "projected data"
        )
    })

    it("shows originalTime with info icon when provided", () => {
        const { container } = render(
            <TooltipValue
                label={column.displayName}
                unit={column.displayUnit}
                value={column.formatValueShort(42)}
                originalTime="2020"
            />
        )

        const timeNotice = container.querySelector(".time-notice")
        expect(timeNotice).toBeTruthy()
        expect(timeNotice?.textContent).toContain("2020")
    })

    it("respects labelVariant unit-only", () => {
        const { container } = render(
            <TooltipValue
                label={column.displayName}
                unit={column.displayUnit}
                value={column.formatValueShort(42)}
                labelVariant="unit-only"
            />
        )

        expect(container.querySelector(".variable--no-name")).toBeTruthy()
    })
})

describe("TooltipValueRange", () => {
    const table = SynthesizeFruitTable()
    const column = table.get(SampleColumnSlugs.Fruit)

    it("renders value range with both values", () => {
        const { container } = render(
            <TooltipValueRange
                label={column.displayName}
                unit={column.displayUnit}
                values={["10", "50"]}
                trend="up"
            />
        )

        const terms = container.querySelectorAll(".term")
        expect(terms).toHaveLength(2)
    })

    it("applies colors to range values", () => {
        const { container } = render(
            <TooltipValueRange
                label={column.displayName}
                unit={column.displayUnit}
                values={["10", "50"]}
                colors={["#ff0000", "#00ff00"]}
                trend="up"
            />
        )

        const terms = container.querySelectorAll(".term span")
        expect(terms[0]?.getAttribute("style")).toContain("#ff0000")
        expect(terms[1]?.getAttribute("style")).toContain("#00ff00")
    })

    it("shows significance superscript when enabled", () => {
        const tableWithRounding = table.updateDefs((def) => {
            if (def.slug === SampleColumnSlugs.Fruit) {
                def.display = {
                    ...def.display,
                    roundingMode: OwidVariableRoundingMode.significantFigures,
                }
            }
            return def
        })
        const columnWithRounding = tableWithRounding.get(
            SampleColumnSlugs.Fruit
        )

        const { container } = render(
            <TooltipValueRange
                label={columnWithRounding.displayName}
                unit={columnWithRounding.displayUnit}
                values={["10", "50"]}
                trend="up"
                isRoundedToSignificantFigures={true}
                showSignificanceSuperscript={true}
            />
        )

        expect(container.querySelector("div.icon-circled-s")).toBeTruthy()
    })

    it("shows originalTimes when provided", () => {
        const { container } = render(
            <TooltipValueRange
                label={column.displayName}
                unit={column.displayUnit}
                values={["10", "50"]}
                trend="up"
                originalTimes={["2019", "2020"]}
            />
        )

        const timeNotice = container.querySelector(".time-notice")
        expect(timeNotice).toBeTruthy()
    })
})

describe("TooltipTable", () => {
    const table = SynthesizeFruitTable()
    const fruitColumn = table.get(SampleColumnSlugs.Fruit)
    const vegColumn = table.get(SampleColumnSlugs.Vegetables)

    it("renders a basic table with rows", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                rows={[
                    {
                        name: "Series 1",
                        values: [42],
                        swatch: { color: "#ff0000" },
                    },
                    {
                        name: "Series 2",
                        values: [84],
                        swatch: { color: "#00ff00" },
                    },
                ]}
            />
        )

        expect(container.querySelector("table")).toBeTruthy()
        expect(container.querySelectorAll("tbody tr")).toHaveLength(2)
    })

    it("renders header for multiple columns", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns([fruitColumn, vegColumn])}
                rows={[
                    {
                        name: "Series 1",
                        values: [42, 10],
                        swatch: { color: "#ff0000" },
                    },
                ]}
            />
        )

        expect(container.querySelector("thead")).toBeTruthy()
        expect(
            container.querySelectorAll("thead td.series-value")
        ).toHaveLength(2)
    })

    it("does not render header for single column", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                rows={[
                    {
                        name: "Series 1",
                        values: [42],
                        swatch: { color: "#ff0000" },
                    },
                ]}
            />
        )

        expect(container.querySelector("thead")).toBeFalsy()
    })

    it("renders swatches with correct colors", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                rows={[
                    {
                        name: "Series 1",
                        values: [42],
                        swatch: { color: "#ff0000", opacity: 0.5 },
                    },
                ]}
            />
        )

        const swatch = container.querySelector(".swatch")
        expect(swatch?.getAttribute("style")).toContain("#ff0000")
        expect(swatch?.getAttribute("style")).toContain("opacity: 0.5")
    })

    it("applies focused class to rows", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                rows={[
                    {
                        name: "Series 1",
                        values: [42],
                        focused: true,
                    },
                ]}
            />
        )

        expect(container.querySelector("tbody tr.focused")).toBeTruthy()
        expect(container.querySelector("table.focal")).toBeTruthy()
    })

    it("applies blurred class to rows", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                rows={[
                    {
                        name: "Series 1",
                        values: [42],
                        blurred: true,
                    },
                ]}
            />
        )

        expect(container.querySelector("tbody tr.blurred")).toBeTruthy()
    })

    it("applies striped class to rows", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                rows={[
                    {
                        name: "Series 1",
                        values: [42],
                        striped: true,
                    },
                ]}
            />
        )

        expect(container.querySelector("tbody tr.striped")).toBeTruthy()
    })

    it("shows totals at bottom by default", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                totals={[100]}
                rows={[
                    { name: "Series 1", values: [40] },
                    { name: "Series 2", values: [60] },
                ]}
            />
        )

        const totalRow = container.querySelector("tr.total")
        expect(totalRow).toBeTruthy()
        expect(totalRow?.querySelector(".series-name")?.textContent).toBe(
            "Total"
        )
    })

    it("shows totals at top when tooltip is anchored to bottom", () => {
        const { container } = render(
            <TooltipContext.Provider
                value={{ anchor: GrapherTooltipAnchor.Bottom }}
            >
                <TooltipTable
                    columns={toTooltipTableColumns(fruitColumn)}
                    totals={[100]}
                    rows={[
                        { name: "Series 1", values: [40] },
                        { name: "Series 2", values: [60] },
                    ]}
                />
            </TooltipContext.Provider>
        )

        const totalRow = container.querySelector("tr.total--top")
        expect(totalRow).toBeTruthy()
    })

    it("hides totals when all values are undefined", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                totals={[undefined]}
                rows={[
                    { name: "Series 1", values: [undefined] },
                    { name: "Series 2", values: [undefined] },
                ]}
            />
        )

        expect(container.querySelector("tr.total")).toBeFalsy()
    })

    it("hides totals when they are all 100%", () => {
        const tableWithPercent = table.updateDefs((def) => {
            if (def.slug === SampleColumnSlugs.Fruit) {
                def.unit = "%"
            }
            return def
        })
        const columnWithPercent = tableWithPercent.get(SampleColumnSlugs.Fruit)

        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(columnWithPercent)}
                totals={[100]}
                rows={[
                    { name: "Series 1", values: [50] },
                    { name: "Series 2", values: [50] },
                ]}
            />
        )

        expect(container.querySelector("tr.total")).toBeFalsy()
    })

    it("renders missing values with missing class", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                rows={[{ name: "Series 1", values: [undefined] }]}
            />
        )

        expect(container.querySelector("td.series-value.missing")).toBeTruthy()
    })

    it("shows originalTime for rows", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                rows={[
                    {
                        name: "Series 1",
                        values: [42],
                        originalTime: "Data from 2019",
                    },
                ]}
            />
        )

        const timeNotice = container.querySelector("td.time-notice")
        expect(timeNotice).toBeTruthy()
        expect(timeNotice?.textContent).toContain("Data from 2019")
    })

    it("handles series names with parenthetical", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                rows={[
                    {
                        name: "United States (USA)",
                        values: [42],
                    },
                ]}
            />
        )

        const name = container.querySelector("td.series-name")
        expect(name?.querySelector(".parenthetical")?.textContent).toBe("(USA)")
    })

    it("renders annotation for rows", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                rows={[
                    {
                        name: "Series 1",
                        values: [42],
                        annotation: "Estimated",
                    },
                ]}
            />
        )

        expect(
            container.querySelector("td.series-name .annotation")?.textContent
        ).toBe("Estimated")
    })

    it("applies swatched class when any row has swatch", () => {
        const { container } = render(
            <TooltipTable
                columns={toTooltipTableColumns(fruitColumn)}
                rows={[
                    {
                        name: "Series 1",
                        values: [42],
                        swatch: { color: "#ff0000" },
                    },
                ]}
            />
        )

        expect(container.querySelector("table.swatched")).toBeTruthy()
    })
})

describe("IconCircledS", () => {
    it("renders icon with circle", () => {
        const { container } = render(<SignificanceIcon />)

        expect(container.querySelector(".icon-circled-s")).toBeTruthy()
        expect(container.querySelector(".circle")).toBeTruthy()
    })

    it("applies superscript class when asSuperscript is true", () => {
        const { container } = render(<SignificanceIcon asSuperscript={true} />)

        expect(container.querySelector(".as-superscript")).toBeTruthy()
    })

    it("does not apply superscript class when asSuperscript is false", () => {
        const { container } = render(<SignificanceIcon asSuperscript={false} />)

        expect(container.querySelector(".as-superscript")).toBeFalsy()
    })
})

describe("makeTooltipToleranceNotice", () => {
    it("returns singular form by default", () => {
        const notice = makeTooltipToleranceNotice("2020")
        expect(notice).toBe(
            "Data not available for 2020. Showing closest available data point instead"
        )
    })
})

describe("makeTooltipRoundingNotice", () => {
    it("returns plural form by default", () => {
        const notice = makeTooltipRoundingNotice([2])
        expect(notice).toBe("Values are rounded to 2 significant figures")
    })

    it("returns singular form when specified", () => {
        const notice = makeTooltipRoundingNotice([2], { plural: false })
        expect(notice).toBe("Value is rounded to 2 significant figures")
    })

    it("uses singular 'figure' for 1 significant figure", () => {
        const notice = makeTooltipRoundingNotice([1])
        expect(notice).toBe("Values are rounded to 1 significant figure")
    })

    it("handles multiple different significance values", () => {
        const notice = makeTooltipRoundingNotice([2, 3, 4])
        expect(notice).toBe(
            "Values are rounded to 2, 3 or 4 significant figures"
        )
    })

    it("removes duplicate values", () => {
        const notice = makeTooltipRoundingNotice([2, 2, 3, 3])
        expect(notice).toBe("Values are rounded to 2 or 3 significant figures")
    })

    it("sorts values in ascending order", () => {
        const notice = makeTooltipRoundingNotice([4, 2, 3])
        expect(notice).toBe(
            "Values are rounded to 2, 3 or 4 significant figures"
        )
    })
})
