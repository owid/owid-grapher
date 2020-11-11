#! /usr/bin/env yarn jest

import { GridCell } from "./GridCell"
import { tsvToMatrix } from "./ExplorerUtils"
import { ExplorerGrammar, ExplorerKeywords } from "./ExplorerGrammar"

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
        expect(cell.cssClasses).toContain(`StringCellType`)
    })

    it("uses the keyword definition for the first cell instead of abstract keyword", () => {
        const cell = new GridCell(
            tsvToMatrix(`title\tHello world`),
            0,
            0,
            ExplorerGrammar
        )
        expect(cell.comment).toContain(ExplorerKeywords.title.description)
    })

    it("can insert a css class to show the user a + button", () => {
        expect(
            new GridCell(
                tsvToMatrix(`title\tHello world`),
                1,
                0,
                ExplorerGrammar
            ).cssClasses
        ).toContain(`ShowDropdownArrow`)
        expect(
            new GridCell(tsvToMatrix(``), 1, 0, ExplorerGrammar).cssClasses
        ).not.toContain(`ShowDropdownArrow`)
    })

    it("can detect errors", () => {
        const cell = new GridCell(
            tsvToMatrix(`tile\tHello world`),
            0,
            0,
            ExplorerGrammar
        )
        expect(cell.errorMessage).not.toEqual(``)
        expect(cell.cssClasses).toContain(`ErrorCellType`)
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
            expect(subtableFrontierCell.cssClasses).toContain(
                `ShowDropdownArrow`
            )
        })

        it("can detect invalid slugs", () => {
            const program = tsvToMatrix(`columns\tBag slug`)
            const cell = new GridCell(program, 0, 1, ExplorerGrammar)
            expect(cell.errorMessage).not.toEqual(``)
        })
    })
})
