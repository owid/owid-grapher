#! /usr/bin/env yarn jest

import { GridCell } from "explorer/gridLang/GridCell"
import { tsvToMatrix } from "./ExplorerUtils"
import { ExplorerGrammar, ExplorerRootKeywordMap } from "./ExplorerGrammar"
import {
    CellHasErrorsClass,
    FrontierCellClass,
    StringCellDef,
} from "explorer/gridLang/GridLangConstants"

describe(GridCell, () => {
    it("can parse a cell", () => {
        const cell = new GridCell(
            tsvToMatrix(`title\tHello world`),
            0,
            1,
            ExplorerGrammar
        )
        expect(cell.errorMessage).toEqual(``)
        expect(cell.comment).toContain(`title`)
        expect(cell.cssClasses).toContain(StringCellDef.cssClass)
        expect(cell.placeholder).toBeFalsy()
    })

    it("can show a placeholder", () => {
        const cell = new GridCell(tsvToMatrix(`title`), 0, 1, ExplorerGrammar)
        expect(cell.placeholder).toBeTruthy()
    })

    it("uses the keyword definition for the first cell instead of abstract keyword", () => {
        const cell = new GridCell(
            tsvToMatrix(`title\tHello world`),
            0,
            0,
            ExplorerGrammar
        )
        expect(cell.comment).toContain(ExplorerRootKeywordMap.title.description)
    })

    it("can insert a css class to show the user a + button", () => {
        expect(
            new GridCell(
                tsvToMatrix(`title\tHello world`),
                1,
                0,
                ExplorerGrammar
            ).cssClasses
        ).toContain(FrontierCellClass)
        expect(
            new GridCell(tsvToMatrix(``), 1, 0, ExplorerGrammar).cssClasses
        ).not.toContain(FrontierCellClass)
    })

    it("can detect errors", () => {
        const cell = new GridCell(
            tsvToMatrix(`tile\tHello world`),
            0,
            0,
            ExplorerGrammar
        )
        expect(cell.errorMessage).not.toEqual(``)
        expect(cell.cssClasses).toContain(CellHasErrorsClass)
    })

    describe("subtables", () => {
        it("can detect header frontier", () => {
            const program = tsvToMatrix(`columns\tsome_slug\n\tslug\tname`)
            const subtableFrontierCell = new GridCell(
                program,
                1,
                3,
                ExplorerGrammar
            )
            expect(subtableFrontierCell.errorMessage).toEqual(``)
            expect(subtableFrontierCell.cssClasses).toContain(FrontierCellClass)
        })

        it("can detect invalid slugs", () => {
            const program = tsvToMatrix(`columns\tBag slug`)
            const cell = new GridCell(program, 0, 1, ExplorerGrammar)
            expect(cell.errorMessage).not.toEqual(``)
        })
    })
})
