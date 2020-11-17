#! /usr/bin/env yarn jest

import { ExplorerProgram, DecisionMatrix } from "./ExplorerProgram"
import { getRequiredGrapherIds } from "./ExplorerUtils"
import {
    CommentCellDef,
    FrontierCellClass,
    GridBoolean,
} from "explorer/gridLang/GridLangConstants"
import {
    ExplorerRootKeywordMap,
    GrapherSubTableHeaderKeywordMap,
} from "./ExplorerGrammar"

const grapherIdKeyword = GrapherSubTableHeaderKeywordMap.grapherId.keyword
const tableSlugKeyword = GrapherSubTableHeaderKeywordMap.tableSlug.keyword

describe(ExplorerProgram, () => {
    const testProgram = `${ExplorerRootKeywordMap.graphers.keyword}
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
        const code = `${ExplorerRootKeywordMap.explorerTitle.keyword}\tData Explorer
${ExplorerRootKeywordMap.graphers.keyword}
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
        expect(program.getCell(0, 0).cssClasses).toContain(
            CommentCellDef.cssClass
        )
        expect(program.getCell(1, 1).cssClasses).not.toContain(
            CommentCellDef.cssClass
        )
        expect(program.getCell(1, 2).cssClasses).toContain(
            CommentCellDef.cssClass
        )
    })

    it("can detect errors", () => {
        const results = new ExplorerProgram("test", `titleTypo Foo`).getCell(
            0,
            0
        )
        expect(results.errorMessage).not.toEqual("")
        expect(results.options!.length).toBeGreaterThan(1)
    })

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
    const options = new DecisionMatrix(code)

    it("starts with a selected chart", () => {
        expect(options.selectedRow.grapherId).toEqual(21)
        expect(options.toObject().country).toEqual("usa")
        expect(options.toObject().indicator).toEqual("GDP")
    })

    it("parses booleans", () => {
        expect(options.selectedRow.perCapita).toEqual(false)
    })

    it("it can get all options", () => {
        expect(options.allOptionsAsQueryStrings().length).toBe(7)
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
        options.setValue("country", "france")
        expect(options.isOptionAvailable("indicator", "GDP")).toEqual(false)
        expect(options.isOptionAvailable("country", "france")).toEqual(true)
        expect(options.isOptionAvailable("interval", "annual")).toEqual(false)
        expect(options.isOptionAvailable("interval", "monthly")).toEqual(false)
        expect(options.toConstrainedOptions().indicator).toEqual(
            "Life expectancy"
        )
        expect(options.toConstrainedOptions().perCapita).toEqual(undefined)
        expect(options.toConstrainedOptions().interval).toEqual(undefined)
        expect(options.toObject().perCapita).toEqual(GridBoolean.false)
        expect(options.toObject().interval).toEqual("annual")
        expect(options.selectedRow.grapherId).toEqual(33)
    })

    it("can handle boolean groups", () => {
        expect(
            options.isOptionAvailable("perCapita", GridBoolean.false)
        ).toEqual(false)
        options.setValue("country", "usa")
        options.setValue("perCapita", "Per million")
        expect(
            options.isOptionAvailable("perCapita", GridBoolean.false)
        ).toEqual(true)
        expect(options.selectedRow.grapherId).toEqual(24)
    })

    it("can show available choices in a later group", () => {
        options.setValue("country", "spain")
        expect(
            options.isOptionAvailable("perCapita", GridBoolean.false)
        ).toEqual(true)
        expect(options.isOptionAvailable("perCapita", "Per million")).toEqual(
            true
        )
        expect(options.isOptionAvailable("interval", "annual")).toEqual(false)
        expect(options.selectedRow.grapherId).toEqual(56)
    })

    it("returns groups with undefined values if invalid value is selected", () => {
        const options = new DecisionMatrix(code)
        options.setValue("country", "usa")
        options.setValue("indicator", "GDP")
        options.setValue("interval", "annual")
        expect(options.choicesWithAvailability[2].value).toEqual("annual")
        options.setValue("country", "spain")
        expect(options.choicesWithAvailability[2].value).toEqual(undefined)
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
        const options = new DecisionMatrix(
            `${grapherIdKeyword},country Radio,indicator Radio
123,usa,
32,usa,
23,france,`
        )
        expect(options.selectedRow.grapherId).toEqual(123)
        expect(options.choicesWithAvailability.length).toBeGreaterThan(0)
    })

    it("handles empty options", () => {
        const options = new DecisionMatrix(``)
        expect(options.choicesWithAvailability.length).toEqual(0)
    })

    describe("checkboxes", () => {
        it("supports checkboxes with available options", () => {
            const options = new DecisionMatrix(`${grapherIdKeyword},PerCapita Checkbox
488,true
4331,false`)
            expect(
                options.choicesWithAvailability[0].options[0].available
            ).toEqual(true)
            expect(
                options.choicesWithAvailability[0].options[0].checked
            ).toEqual(true)
        })

        it("supports checkboxes with no available options", () => {
            const options = new DecisionMatrix(`${grapherIdKeyword},PerCapita Checkbox
488,true
4331,true`)
            expect(
                options.choicesWithAvailability[0].options[0].available
            ).toEqual(false)
            expect(
                options.choicesWithAvailability[0].options[0].checked
            ).toEqual(true)
        })
    })

    it("marks a radio as checked if its the only option", () => {
        const options = new DecisionMatrix(
            `${grapherIdKeyword},Gas Radio,Accounting Radio
488,CO₂,Production-based
4331,CO₂,Consumption-based
4147,GHGs,Production-based`
        )
        options.setValue("Gas", "CO₂")
        options.setValue("Accounting", "Consumption-based")
        options.setValue("Gas", "GHGs")
        expect(options.selectedRow.grapherId).toEqual(4147)
        expect(options.toConstrainedOptions()["Accounting"]).toEqual(
            "Production-based"
        )
        expect(options.choicesWithAvailability[1].value).toEqual(
            "Production-based"
        )
        expect(options.choicesWithAvailability[1].options[0].value).toEqual(
            "Production-based"
        )
        expect(options.choicesWithAvailability[1].options[0].checked).toEqual(
            true
        )
    })

    describe("subtables", () => {
        it("can detect header frontier", () => {
            const subtableFrontierCell = new ExplorerProgram(
                "test",
                `columns\tsome_slug\n\tslug\tname`
            ).getCell(1, 3)
            expect(subtableFrontierCell.errorMessage).toEqual(``)
            expect(subtableFrontierCell.cssClasses).toContain(FrontierCellClass)
        })

        it("can detect invalid slugs", () => {
            const cell = new ExplorerProgram(
                "test",
                `columns\tBag slug`
            ).getCell(0, 1)
            expect(cell.errorMessage).not.toEqual(``)
        })

        it("can detect header frontier", () => {
            const subtableFrontierCell = new ExplorerProgram(
                "test",
                `columns\tsome_slug\n\tslug\tname`
            ).getCell(1, 3)
            expect(subtableFrontierCell.errorMessage).toEqual(``)
            expect(subtableFrontierCell.cssClasses).toContain(FrontierCellClass)
        })

        it("can detect invalid slugs", () => {
            const cell = new ExplorerProgram(
                "test",
                `columns\tBag slug`
            ).getCell(0, 1)
            expect(cell.errorMessage).not.toEqual(``)
        })
    })
})
