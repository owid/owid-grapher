#! /usr/bin/env jest

import { GridCell } from "explorer/gridLang/GridCell"
import {
    CellDef,
    CellHasErrorsClass,
    FrontierCellClass,
    Grammar,
    RootKeywordCellDef,
    StringCellDef,
} from "explorer/gridLang/GridLangConstants"
import { tsvToMatrix } from "./GrammarUtils"

const TestGrammar: Grammar = {
    title: {
        ...StringCellDef,
        keyword: "title",
        placeholder: "A whole new world",
        description: "Some description",
    },
} as const

const TestGrammarRootDef: CellDef = {
    ...RootKeywordCellDef,
    grammar: TestGrammar,
}

describe(GridCell, () => {
    it("can parse a cell", () => {
        const cell = new GridCell(
            tsvToMatrix(`title\tHello world`),
            { row: 0, column: 1 },
            TestGrammarRootDef
        )
        expect(cell.errorMessage).toEqual(``)
        expect(cell.comment).toContain(TestGrammar.title.description)
        expect(cell.cssClasses).toContain(StringCellDef.cssClass)
        expect(cell.placeholder).toBeFalsy()
    })

    it("can show a placeholder", () => {
        const cell = new GridCell(
            tsvToMatrix(`title`),
            { row: 0, column: 1 },
            TestGrammarRootDef
        )
        expect(cell.placeholder).toBeTruthy()
    })

    it("uses the keyword definition for the first cell instead of abstract keyword", () => {
        const cell = new GridCell(
            tsvToMatrix(`title\tHello world`),
            { row: 0, column: 0 },
            TestGrammarRootDef
        )
        expect(cell.comment).toContain(TestGrammar.title.description)
    })

    it("can insert a css class to show the user a + button", () => {
        expect(
            new GridCell(
                tsvToMatrix(`title\tHello world`),
                { row: 1, column: 0 },
                TestGrammarRootDef
            ).cssClasses
        ).toContain(FrontierCellClass)
        expect(
            new GridCell(
                tsvToMatrix(``),
                { row: 1, column: 0 },
                TestGrammarRootDef
            ).cssClasses
        ).not.toContain(FrontierCellClass)
    })

    it("can detect errors", () => {
        const cell = new GridCell(
            tsvToMatrix(`tile\tHello world`),
            { row: 0, column: 0 },
            TestGrammarRootDef
        )
        expect(cell.errorMessage).not.toEqual(``)
        expect(cell.cssClasses).toContain(CellHasErrorsClass)
    })
})
