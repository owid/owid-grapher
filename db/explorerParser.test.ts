import { describe, expect, it } from "vitest"
import { parseExplorer } from "./explorerParser.js"

describe("parseExplorer", () => {
    it("parses table blocks correctly", () => {
        const tsv = `table
\tmyDataVar\tanotherVar
\t1\t2
\t3\t4`
        const result = parseExplorer("test-table", tsv)

        expect(result).toEqual({
            _version: 1,
            blocks: [
                {
                    type: "table",
                    args: [],
                    block: [
                        { myDataVar: "1", anotherVar: "2" },
                        { myDataVar: "3", anotherVar: "4" },
                    ],
                },
            ],
            isPublished: "false",
        })
    })

    it("parses basic TSV structure", () => {
        const tsv = `explorerTitle\tMy Explorer
isPublished\tfalse
explorerSubtitle\tThis is a test explorer
selection\tWorld\tUnited States
graphers
\tgrapherId\tTest Radio\ttype\tySlugs
\t488\tA\tLineChart\tgdp
\t4331\tB\tScatterPlot\tlife_expectancy
columns
\tslug\ttype\tname
\tgdp\tNumeric\tGDP
\tlife_expectancy\tNumeric\tLife Expectancy`

        const result = parseExplorer("test-explorer", tsv)

        expect(result).toEqual({
            _version: 1,
            explorerTitle: "My Explorer",
            isPublished: "false",
            explorerSubtitle: "This is a test explorer",
            selection: ["World", "United States"],
            blocks: [
                {
                    type: "graphers",
                    args: [],
                    block: [
                        {
                            grapherId: "488",
                            "Test Radio": "A",
                            type: "LineChart",
                            ySlugs: "gdp",
                        },
                        {
                            grapherId: "4331",
                            "Test Radio": "B",
                            type: "ScatterPlot",
                            ySlugs: "life_expectancy",
                        },
                    ],
                },
                {
                    type: "columns",
                    args: [],
                    block: [
                        { slug: "gdp", type: "Numeric", name: "GDP" },
                        {
                            slug: "life_expectancy",
                            type: "Numeric",
                            name: "Life Expectancy",
                        },
                    ],
                },
            ],
        })
    })
})
