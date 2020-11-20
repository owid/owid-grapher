#! /usr/bin/env yarn jest

import { ExplorerProgram, DecisionMatrix } from "./ExplorerProgram"
import { getRequiredGrapherIds } from "explorer/client/ExplorerProgramUtils"
import {
    CommentCellDef,
    FrontierCellClass,
    GridBoolean,
} from "explorer/gridLang/GridLangConstants"
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
        expect(program.requiredGrapherIds).toEqual([35])
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
        expect(new ExplorerProgram("test", code).requiredGrapherIds).toEqual([
            35,
            46,
        ])
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
        expect(decisionMatrix.toObject().country).toEqual("usa")
        expect(decisionMatrix.toObject().indicator).toEqual("GDP")
    })

    it("parses booleans", () => {
        expect(decisionMatrix.selectedRow.perCapita).toEqual(false)
    })

    it("it can get all options", () => {
        expect(decisionMatrix.allOptionsAsQueryStrings().length).toBe(7)
    })

    it("can detect needed chart configs", () => {
        expect(getRequiredGrapherIds(code)).toEqual([
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
        decisionMatrix.setValue("country", "france")
        expect(decisionMatrix.isOptionAvailable("indicator", "GDP")).toEqual(
            false
        )
        expect(decisionMatrix.isOptionAvailable("country", "france")).toEqual(
            true
        )
        expect(decisionMatrix.isOptionAvailable("interval", "annual")).toEqual(
            false
        )
        expect(decisionMatrix.isOptionAvailable("interval", "monthly")).toEqual(
            false
        )
        expect(decisionMatrix.toConstrainedOptions().indicator).toEqual(
            "Life expectancy"
        )
        expect(decisionMatrix.toConstrainedOptions().perCapita).toEqual(
            undefined
        )
        expect(decisionMatrix.toConstrainedOptions().interval).toEqual(
            undefined
        )
        expect(decisionMatrix.toObject().perCapita).toEqual(GridBoolean.false)
        expect(decisionMatrix.toObject().interval).toEqual("annual")
        expect(decisionMatrix.selectedRow.grapherId).toEqual(33)
    })

    it("can handle boolean groups", () => {
        expect(
            decisionMatrix.isOptionAvailable("perCapita", GridBoolean.false)
        ).toEqual(false)
        decisionMatrix.setValue("country", "usa")
        decisionMatrix.setValue("perCapita", "Per million")
        expect(
            decisionMatrix.isOptionAvailable("perCapita", GridBoolean.false)
        ).toEqual(true)
        expect(decisionMatrix.selectedRow.grapherId).toEqual(24)
    })

    it("can show available choices in a later group", () => {
        decisionMatrix.setValue("country", "spain")
        expect(
            decisionMatrix.isOptionAvailable("perCapita", GridBoolean.false)
        ).toEqual(true)
        expect(
            decisionMatrix.isOptionAvailable("perCapita", "Per million")
        ).toEqual(true)
        expect(decisionMatrix.isOptionAvailable("interval", "annual")).toEqual(
            false
        )
        expect(decisionMatrix.selectedRow.grapherId).toEqual(56)
    })

    it("returns groups with undefined values if invalid value is selected", () => {
        const decisionMatrix = new DecisionMatrix(code)
        decisionMatrix.setValue("country", "usa")
        decisionMatrix.setValue("indicator", "GDP")
        decisionMatrix.setValue("interval", "annual")
        expect(decisionMatrix.choicesWithAvailability[2].value).toEqual(
            "annual"
        )
        decisionMatrix.setValue("country", "spain")
        expect(decisionMatrix.choicesWithAvailability[2].value).toEqual(
            undefined
        )
    })

    it("fails if no grapherId column is provided", () => {
        try {
            new DecisionMatrix(
                `country Radio,indicator Radio
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
            decisionMatrix.setValue("Other", "A")
            const {
                available,
                checked,
                value,
            } = decisionMatrix.choicesWithAvailability[1].options[0]
            expect(checked).toEqual(true)
            expect(value).toEqual("true")
            expect(available).toEqual(false)

            {
                decisionMatrix.setValue("PerCapita", "false")
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
            decisionMatrix.setValue("Letter", "A")
            decisionMatrix.setValue("Number", "2")
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
        decisionMatrix.setValue("Gas", "CO₂")
        decisionMatrix.setValue("Accounting", "Consumption-based")
        decisionMatrix.setValue("Gas", "GHGs")
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
