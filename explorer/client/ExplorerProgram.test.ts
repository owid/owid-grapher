#! /usr/bin/env jest

import { ExplorerProgram, DecisionMatrix } from "./ExplorerProgram"
import {
    CommentCellDef,
    FrontierCellClass,
    GridBoolean,
} from "gridLang/GridLangConstants"
import { ExplorerGrammar } from "explorer/grammars/ExplorerGrammar"
import { GrapherGrammar } from "explorer/grammars/GrapherGrammar"

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
            `# a comment
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
    country = "country Radio",
    indicator = "indicator Radio",
    interval = "interval Radio",
    perCapita = "perCapita Radio",
}

describe(DecisionMatrix, () => {
    const code = `${grapherIdKeyword},${Object.values(Choices).join(",")}
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
        expect(decisionMatrix.currentPatch[Choices.country]).toEqual("usa")
        expect(decisionMatrix.currentPatch[Choices.indicator]).toEqual("GDP")
    })

    it("parses booleans", () => {
        expect(decisionMatrix.selectedRow[Choices.perCapita]).toEqual(false)
    })

    it("it can get all options", () => {
        expect(decisionMatrix.allDecisionsAsPatches().length).toBe(7)
    })

    it("can detect needed chart configs", () => {
        expect(decisionMatrix.requiredGrapherIds).toEqual([
            21,
            24,
            26,
            29,
            33,
            55,
            56,
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
        expect(decisionMatrix.currentPatch[Choices.perCapita]).toEqual(
            GridBoolean.false
        )
        expect(decisionMatrix.currentPatch[Choices.interval]).toEqual("annual")
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
            `${grapherIdKeyword},${Choices.country},${Choices.indicator}
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
            const decisionMatrix = new DecisionMatrix(`${grapherIdKeyword},PerCapita Checkbox
488,true
4331,false`)
            const {
                available,
                checked,
            } = decisionMatrix.choicesWithAvailability[0].options[0]

            expect(available).toEqual(true)
            expect(checked).toEqual(true)
        })

        it("supports checkboxes with no available options", () => {
            const decisionMatrix = new DecisionMatrix(`${grapherIdKeyword},Other Radio,PerCapita Checkbox
488,A,true
4331,A,true
4331,B,false`)
            decisionMatrix.setValueCommand("Other Radio", "A")
            const {
                available,
                checked,
                value,
            } = decisionMatrix.choicesWithAvailability[1].options[0]
            expect(checked).toEqual(true)
            expect(value).toEqual("true")
            expect(available).toEqual(false)

            {
                decisionMatrix.setValueCommand("PerCapita", "false")
                const {
                    available,
                    checked,
                    value,
                } = decisionMatrix.choicesWithAvailability[1].options[0]
                expect(available).toEqual(false)
                expect(checked).toEqual(true)
                expect(value).toEqual("true")
            }
        })

        it("handles illogical states", () => {
            const decisionMatrix = new DecisionMatrix(`${grapherIdKeyword},Letter Radio,Number Radio,PerCapita Checkbox
488,A,1,true
4331,A,1,true
4331,B,2,false`)
            decisionMatrix.setValueCommand("Letter Radio", "A")
            decisionMatrix.setValueCommand("Number Radio", "2")
            const {
                available,
                checked,
                value,
            } = decisionMatrix.choicesWithAvailability[2].options[0]
            expect(checked).toEqual(true)
            expect(value).toEqual("true")
            expect(available).toEqual(false)
        })
    })

    it("marks a radio as checked if its the only option", () => {
        const decisionMatrix = new DecisionMatrix(
            `${grapherIdKeyword},Gas Radio,Accounting Radio
488,CO₂,Production-based
4331,CO₂,Consumption-based
4147,GHGs,Production-based`
        )
        decisionMatrix.setValueCommand("Gas Radio", "CO₂")
        decisionMatrix.setValueCommand("Accounting Radio", "Consumption-based")
        decisionMatrix.setValueCommand("Gas Radio", "GHGs")
        expect(decisionMatrix.selectedRow.grapherId).toEqual(4147)
        expect(
            decisionMatrix.toConstrainedOptions()["Accounting Radio"]
        ).toEqual("Production-based")
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
})
