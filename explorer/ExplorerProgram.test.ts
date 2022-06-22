#! /usr/bin/env jest

import { ExplorerProgram } from "./ExplorerProgram.js"
import {
    CommentCellDef,
    FrontierCellClass,
    GridBoolean,
} from "../gridLang/GridLangConstants.js"
import { ExplorerGrammar } from "./ExplorerGrammar.js"
import { GrapherGrammar } from "./GrapherGrammar.js"
import { DecisionMatrix } from "./ExplorerDecisionMatrix.js"

const grapherIdKeyword = GrapherGrammar.grapherId.keyword
const tableSlugKeyword = GrapherGrammar.tableSlug.keyword

describe(ExplorerProgram, () => {
    const testProgram = `${ExplorerGrammar.graphers.keyword}
	${grapherIdKeyword}	Examples Radio	title	subtitle	${tableSlugKeyword}	type	ySlugs	hasMapTab
	35	Load A Grapher Demo
		Create A Grapher Demo	Hello world	This is a subtitle	demo	DiscreteBar	gdp	true
		Data from CSV Demo	Healthy Life Expectancy		lifeExpectancy	LineChart	Healthy-Life-Expectancy-IHME`
    const program = new ExplorerProgram("test", testProgram)
    it("gets the required grapher ids", () => {
        expect(program.decisionMatrix.requiredGrapherIds).toEqual([35])
    })

    it("gets code", () => {
        expect(program.decisionMatrixCode).toContain(grapherIdKeyword)
    })

    it("allows blank lines in blocks", () => {
        const code = `${ExplorerGrammar.explorerTitle.keyword}\tData Explorer
${ExplorerGrammar.graphers.keyword}
\t${grapherIdKeyword}\tDevice Radio
\t35\tInternet

\t46\tMobile`
        expect(
            new ExplorerProgram("test", code).decisionMatrix.requiredGrapherIds
        ).toEqual([35, 46])
    })

    it("supports comments", () => {
        const program = new ExplorerProgram(
            "test",
            `## a comment
\t\t💬 another comment starting with a 💬 `
        )
        expect(program.getCell({ row: 0, column: 0 }).cssClasses).toContain(
            CommentCellDef.cssClass
        )
        expect(program.getCell({ row: 1, column: 1 }).cssClasses).not.toContain(
            CommentCellDef.cssClass
        )
        expect(program.getCell({ row: 1, column: 2 }).cssClasses).toContain(
            CommentCellDef.cssClass
        )
    })

    it("properly assigns column defs to table slugs", () => {
        const program = new ExplorerProgram(
            "test",
            `columns
\tslug\tname
\tgdp\tGDP
columns\ttable1\ttable2\ttable3
\tslug\tname
\tbanana\tBananas`
        )

        expect([...program.columnDefsByTableSlug.keys()]).toEqual([
            undefined,
            "table1",
            "table2",
            "table3",
        ])

        const columnDef1 = [{ slug: "gdp", name: "GDP" }]
        const columnDef2 = [{ slug: "banana", name: "Bananas" }]

        expect(program.columnDefsByTableSlug.get(undefined)).toEqual(columnDef1)
        expect(program.columnDefsByTableSlug.get("table1")).toEqual(columnDef2)
        expect(program.columnDefsByTableSlug.get("table2")).toEqual(columnDef2)
        expect(program.columnDefsByTableSlug.get("table3")).toEqual(columnDef2)
    })

    it("can detect errors", () => {
        const results = new ExplorerProgram("test", `titleTypo Foo`).getCell({
            row: 0,
            column: 0,
        })
        expect(results.errorMessage).not.toEqual("")
        expect(results.optionKeywords!.length).toBeGreaterThan(1)
    })

    it("can detect errors in subtables", () => {
        const results = new ExplorerProgram(
            "test",
            `columns\n\ttype\n\tBadNumericType`
        ).getCell({
            row: 2,
            column: 1,
        })
        expect(results.errorMessage).not.toEqual("")
        expect(results.optionKeywords!.length).toBeGreaterThan(1)
    })

    describe("grapherconfig", () => {
        it("can return a grapher config", () => {
            expect(
                new ExplorerProgram("test", `yScaleToggle\ttrue`).grapherConfig
                    .yScaleToggle
            ).toEqual(true)
            const program = new ExplorerProgram(
                "test",
                `graphers
\tyScaleToggle\tLine Checkbox
\ttrue\tLine`
            )
            expect(program.currentlySelectedGrapherRow).toEqual(2)
            expect(program.grapherConfig.yScaleToggle).toEqual(true)
        })

        it("can convert \\n to a newline", () => {
            const program = new ExplorerProgram(
                "test",
                `graphers
\tsubtitle\tLine Checkbox
\tThis is a\\ntwo-line subtitle\tLine`
            )
            expect(program.grapherConfig.subtitle).toEqual(
                "This is a\ntwo-line subtitle"
            )
        })

        it("can cascade default grapher config props", () => {
            const program = new ExplorerProgram(
                "test",
                `hasMapTab\ttrue
table\tfoo
graphers
\tyScaleToggle\tLine Checkbox
\ttrue\tLine`
            )
            expect(program.grapherConfig.hasMapTab).toEqual(true)
            // Only parse white listed grapher props
            expect((program.grapherConfig as any).table).toEqual(undefined)
        })
    })

    it("can power a grapher", () => {
        const grapherConfig = new ExplorerProgram(
            "test",
            `title\tFoo\nySlugs\tgdp`
        ).tuplesObject
        expect(grapherConfig).toEqual({ title: "Foo", ySlugs: "gdp" })
    })

    it("can set a facet y domain", () => {
        const grapherConfig = new ExplorerProgram(
            "test",
            `facetYDomain\tindependent`
        ).tuplesObject
        expect(grapherConfig).toEqual({ facetYDomain: "independent" })
    })

    it("prefers inline data to url if it has both", () => {
        const program = new ExplorerProgram(
            "test",
            `table\thttp://url
\tinlineData`
        )
        const def = program.getTableDef()!
        expect(def.url).toBeFalsy()
        expect(def.inlineData).toBeTruthy
    })
})

enum Choices {
    country = "country",
    indicator = "indicator",
    interval = "interval",
    perCapita = "perCapita",
}

describe(DecisionMatrix, () => {
    const code = `${grapherIdKeyword},country Radio,indicator Radio,interval Radio,perCapita Radio
21,usa,GDP,annual,${GridBoolean.false}
24,usa,GDP,annual,Per million
26,usa,GDP,monthly,
29,usa,Life expectancy,,
33,france,Life expectancy,,
55,spain,GDP,,${GridBoolean.false}
56,spain,GDP,,Per million`
    const decisionMatrix = new DecisionMatrix(code)

    it("starts with a selected chart", () => {
        expect(decisionMatrix.selectedRow.grapherId).toEqual(21)
        expect(decisionMatrix.currentParams[Choices.country]).toEqual("usa")
        expect(decisionMatrix.currentParams[Choices.indicator]).toEqual("GDP")
    })

    it("parses booleans", () => {
        expect(decisionMatrix.selectedRow[Choices.perCapita]).toEqual(false)
    })

    it("it can get all options", () => {
        expect(decisionMatrix.allDecisionsAsQueryParams().length).toBe(7)
    })

    it("can detect needed chart configs", () => {
        expect(decisionMatrix.requiredGrapherIds).toEqual([
            21, 24, 26, 29, 33, 55, 56,
        ])
    })

    it("can detect unavailable options", () => {
        decisionMatrix.setValueCommand(Choices.country, "france")
        expect(
            decisionMatrix.isOptionAvailable(Choices.indicator, "GDP")
        ).toEqual(false)
        expect(
            decisionMatrix.isOptionAvailable(Choices.country, "france")
        ).toEqual(true)
        expect(
            decisionMatrix.isOptionAvailable(Choices.interval, "annual")
        ).toEqual(false)
        expect(
            decisionMatrix.isOptionAvailable(Choices.interval, "monthly")
        ).toEqual(false)
        expect(
            decisionMatrix.toConstrainedOptions()[Choices.indicator]
        ).toEqual("Life expectancy")
        expect(
            decisionMatrix.toConstrainedOptions()[Choices.perCapita]
        ).toEqual(undefined)
        expect(decisionMatrix.toConstrainedOptions()[Choices.interval]).toEqual(
            undefined
        )
        expect(decisionMatrix.currentParams[Choices.perCapita]).toEqual(
            GridBoolean.false
        )
        expect(decisionMatrix.currentParams[Choices.interval]).toEqual("annual")
        expect(decisionMatrix.selectedRow.grapherId).toEqual(33)
    })

    it("can handle boolean groups", () => {
        expect(
            decisionMatrix.isOptionAvailable(
                Choices.perCapita,
                GridBoolean.false
            )
        ).toEqual(false)
        decisionMatrix.setValueCommand(Choices.country, "usa")
        decisionMatrix.setValueCommand(Choices.perCapita, "Per million")
        expect(
            decisionMatrix.isOptionAvailable(
                Choices.perCapita,
                GridBoolean.false
            )
        ).toEqual(true)
        expect(decisionMatrix.selectedRow.grapherId).toEqual(24)
    })

    it("can show available choices in a later group", () => {
        decisionMatrix.setValueCommand(Choices.country, "spain")
        expect(
            decisionMatrix.isOptionAvailable(
                Choices.perCapita,
                GridBoolean.false
            )
        ).toEqual(true)
        expect(
            decisionMatrix.isOptionAvailable(Choices.perCapita, "Per million")
        ).toEqual(true)
        expect(
            decisionMatrix.isOptionAvailable(Choices.interval, "annual")
        ).toEqual(false)
        expect(decisionMatrix.selectedRow.grapherId).toEqual(56)
    })

    it("returns groups with undefined values if invalid value is selected", () => {
        const decisionMatrix = new DecisionMatrix(code)
        decisionMatrix.setValueCommand(Choices.country, "usa")
        decisionMatrix.setValueCommand(Choices.indicator, "GDP")
        decisionMatrix.setValueCommand(Choices.interval, "annual")
        expect(decisionMatrix.choicesWithAvailability[2].value).toEqual(
            "annual"
        )
        decisionMatrix.setValueCommand(Choices.country, "spain")
        expect(decisionMatrix.choicesWithAvailability[2].value).toEqual(
            undefined
        )
    })

    it("fails if no grapherId column is provided", () => {
        try {
            new DecisionMatrix(
                `${Choices.country},${Choices.indicator}
usa,GDP
usa,Life expectancy
france,Life expectancy`
            )
            expect(true).toBe(false)
        } catch (err) {
            expect(true).toBe(true)
        }
    })

    it("handles columns without options", () => {
        const decisionMatrix = new DecisionMatrix(
            `${grapherIdKeyword},country Radio,indicator Radio
123,usa,
32,usa,
23,france,`
        )
        expect(decisionMatrix.selectedRow.grapherId).toEqual(123)
        expect(decisionMatrix.choicesWithAvailability.length).toBeGreaterThan(0)
    })

    it("handles empty options", () => {
        const decisionMatrix = new DecisionMatrix(``)
        expect(decisionMatrix.choicesWithAvailability.length).toEqual(0)
    })

    describe("checkboxes", () => {
        it("supports checkboxes with available options", () => {
            const decisionMatrix =
                new DecisionMatrix(`${grapherIdKeyword},PerCapita Checkbox
488,true
4331,false`)
            const { available, checked } =
                decisionMatrix.choicesWithAvailability[0].options[0]

            expect(available).toEqual(true)
            expect(checked).toEqual(true)
        })

        it("supports checkboxes with no available options", () => {
            const decisionMatrix =
                new DecisionMatrix(`${grapherIdKeyword},Other Radio,PerCapita Checkbox
488,A,true
4331,A,true
4331,B,false`)
            decisionMatrix.setValueCommand("Other", "A")
            const { available, checked, value } =
                decisionMatrix.choicesWithAvailability[1].options[0]
            expect(checked).toEqual(true)
            expect(value).toEqual("true")
            expect(available).toEqual(false)

            {
                decisionMatrix.setValueCommand("PerCapita", "false")
                const { available, checked, value } =
                    decisionMatrix.choicesWithAvailability[1].options[0]
                expect(available).toEqual(false)
                expect(checked).toEqual(true)
                expect(value).toEqual("true")
            }
        })

        it("handles illogical states", () => {
            const decisionMatrix =
                new DecisionMatrix(`${grapherIdKeyword},Letter Radio,Number Radio,PerCapita Checkbox
488,A,1,true
4331,A,1,true
4331,B,2,false`)
            decisionMatrix.setValueCommand("Letter", "A")
            decisionMatrix.setValueCommand("Number", "2")
            const { available, checked, value } =
                decisionMatrix.choicesWithAvailability[2].options[0]
            expect(checked).toEqual(true)
            expect(value).toEqual("true")
            expect(available).toEqual(false)
        })
    })

    it("marks a radio as checked if it's the only option", () => {
        const decisionMatrix = new DecisionMatrix(
            `${grapherIdKeyword},Gas Radio,Accounting Radio
488,CO₂,Production-based
4331,CO₂,Consumption-based
4147,GHGs,Production-based`
        )
        decisionMatrix.setValueCommand("Gas", "CO₂")
        decisionMatrix.setValueCommand("Accounting", "Consumption-based")
        decisionMatrix.setValueCommand("Gas", "GHGs")
        expect(decisionMatrix.selectedRow.grapherId).toEqual(4147)
        expect(decisionMatrix.toConstrainedOptions()["Accounting"]).toEqual(
            "Production-based"
        )
        expect(decisionMatrix.choicesWithAvailability[1].value).toEqual(
            "Production-based"
        )
        expect(
            decisionMatrix.choicesWithAvailability[1].options[0].value
        ).toEqual("Production-based")
        expect(
            decisionMatrix.choicesWithAvailability[1].options[0].checked
        ).toEqual(true)
    })

    // See logic in setValueCommand for an explanation of the logic we want to test here.
    it("overwrite unavailable option with new option, if more than 1 option is available", () => {
        const decisionMatrix = new DecisionMatrix(
            `${grapherIdKeyword},Metric Dropdown,Interval Dropdown,Relative to population Checkbox,Align outbreaks Checkbox
1,Cases,Daily,true,false
2,Cases,Daily,true,true
3,Cases,Weekly,true,true
4,Cases,Cumulative,true,true
5,Cases,Cumulative,false,false
6,Cases,Cumulative,true,false
7,Tests,Daily,false,false
8,Tests,Cumulative,false,false`
        )
        decisionMatrix.setValueCommand("Metric", "Cases")
        decisionMatrix.setValueCommand("Interval", "Weekly")
        expect(decisionMatrix.selectedRow.grapherId).toEqual(3)
        decisionMatrix.setValueCommand("Metric", "Tests")
        expect(decisionMatrix.selectedRow.grapherId).toEqual(7)
        decisionMatrix.setValueCommand("Metric", "Cases")
        expect(decisionMatrix.selectedRow.grapherId).toEqual(1)
    })

    it("allows to change 'Relative to population' after 'Interval' has been forcibly set to another choice", () => {
        const decisionMatrix = new DecisionMatrix(
            `${grapherIdKeyword},Metric Dropdown,Interval Dropdown,Relative to population Checkbox
1,Cases,Daily,true
2,Cases,Weekly,true
3,Cases,Cumulative,true
4,Cases,Cumulative,false
5,Tests,Cumulative,true
6,Tests,Cumulative,false`
        )

        decisionMatrix.setValueCommand("Metric", "Tests")
        expect(decisionMatrix.selectedRow.grapherId).toEqual(5)
        decisionMatrix.setValueCommand("Relative to population", "false")
        expect(decisionMatrix.selectedRow.grapherId).toEqual(6)
    })

    describe("subtables", () => {
        it("can detect header frontier", () => {
            const subtableFrontierCell = new ExplorerProgram(
                "test",
                `columns\tsome_slug\n\tslug\tname`
            ).getCell({ row: 1, column: 3 })
            expect(subtableFrontierCell.errorMessage).toEqual(``)
            expect(subtableFrontierCell.cssClasses).toContain(FrontierCellClass)
        })

        it("can detect invalid slugs", () => {
            const cell = new ExplorerProgram(
                "test",
                `columns\tBag slug`
            ).getCell({ row: 0, column: 1 })
            expect(cell.errorMessage).not.toEqual(``)
        })

        it("can detect header frontier", () => {
            const subtableFrontierCell = new ExplorerProgram(
                "test",
                `columns\tsome_slug\n\tslug\tname`
            ).getCell({ row: 1, column: 3 })
            expect(subtableFrontierCell.errorMessage).toEqual(``)
            expect(subtableFrontierCell.cssClasses).toContain(FrontierCellClass)
        })

        it("can detect invalid slugs", () => {
            const cell = new ExplorerProgram(
                "test",
                `columns\tBag slug`
            ).getCell({ row: 0, column: 1 })
            expect(cell.errorMessage).not.toEqual(``)
        })
    })

    describe("defaultView", () => {
        const matrix = `${grapherIdKeyword},Metric Dropdown,Interval Dropdown,Relative to population Checkbox,defaultView
1,Cases,Daily,true,
2,Cases,Weekly,true,
3,Cases,Cumulative,true,
4,Cases,Cumulative,false,
5,Tests,Cumulative,true,true
6,Tests,Cumulative,false,
7,Deaths,Biweekly,false,`

        it("can set a default view", () => {
            const decisionMatrix = new DecisionMatrix(matrix)

            expect(decisionMatrix.selectedRow.grapherId).toEqual(5)
        })

        describe("can override defaults", () => {
            it("case 1: Change the first param: Metric", () => {
                const decisionMatrix = new DecisionMatrix(matrix)

                decisionMatrix.setValuesFromChoiceParams({ Metric: "Cases" })
                expect(decisionMatrix.selectedRow.grapherId).toEqual(3)
            })

            it("case 2: Change the last param: Relative to population", () => {
                const decisionMatrix = new DecisionMatrix(matrix)

                decisionMatrix.setValuesFromChoiceParams({
                    "Relative to population": "false",
                })
                expect(decisionMatrix.selectedRow.grapherId).toEqual(6)
            })

            it("case 3: Change Metric in such a way that Interval and Relative also need to be implicitly changed", () => {
                const decisionMatrix = new DecisionMatrix(matrix)

                decisionMatrix.setValuesFromChoiceParams({ Metric: "Deaths" })
                expect(decisionMatrix.selectedRow.grapherId).toEqual(7)

                expect(decisionMatrix.toConstrainedOptions()).toEqual({
                    Metric: "Deaths",
                    Interval: "Biweekly",
                    "Relative to population": "false",
                })
            })
        })

        it("falls back to the defaultView", () => {
            const decisionMatrix = new DecisionMatrix(matrix)

            decisionMatrix.setValuesFromChoiceParams({ Metric: "Nonexistent" })
            expect(decisionMatrix.selectedRow.grapherId).toEqual(5)

            decisionMatrix.setValuesFromChoiceParams({
                Metric: "Nonexistent",
                "Relative to population": "false",
            })
            expect(decisionMatrix.selectedRow.grapherId).toEqual(6)
        })
    })
})
