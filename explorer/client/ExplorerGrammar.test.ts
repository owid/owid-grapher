#! /usr/bin/env yarn jest

import { ExplorerProgramCell } from "./ExplorerGrammar"
import { tsvToMatrix } from "./ExplorerUtils"

describe(ExplorerProgramCell, () => {
    it("can parse a cell", () => {
        const cell = new ExplorerProgramCell(
            tsvToMatrix(`title\tHello world`),
            0,
            1
        )
        expect(cell.errorMessage).toEqual(``)
        expect(cell.comment).toContain(`title`)
        expect(cell.cssClasses).toContain(`StringCellType`)
    })

    it("uses the keyword definition for the first cell instead of abstract keyword", () => {
        const cell = new ExplorerProgramCell(
            tsvToMatrix(`title\tHello world`),
            0,
            0
        )
        expect(cell.comment).toContain(`title: `)
    })

    it("can insert a css class to show the user a + button", () => {
        expect(
            new ExplorerProgramCell(tsvToMatrix(`title\tHello world`), 1, 0)
                .cssClasses
        ).toContain(`ShowDropdownArrow`)
        expect(
            new ExplorerProgramCell(tsvToMatrix(``), 1, 0).cssClasses
        ).not.toContain(`ShowDropdownArrow`)
    })

    it("can detect errors", () => {
        const cell = new ExplorerProgramCell(
            tsvToMatrix(`tile\tHello world`),
            0,
            0
        )
        expect(cell.errorMessage).not.toEqual(``)
        expect(cell.cssClasses).toContain(`ErrorCellType`)
    })

    describe("subtables", () => {
        it("can detect header frontier", () => {
            const program = tsvToMatrix(`columns\tsome_slug\n\tslug\tname`)
            const subtableFrontierCell = new ExplorerProgramCell(program, 1, 3)
            expect(subtableFrontierCell.errorMessage).toEqual(``)
            expect(subtableFrontierCell.cssClasses).toContain(
                `ShowDropdownArrow`
            )
        })

        it("can detect invalid slugs", () => {
            const program = tsvToMatrix(`columns\tBag slug`)
            const cell = new ExplorerProgramCell(program, 0, 1)
            expect(cell.errorMessage).not.toEqual(``)
        })
    })
})
