#! /usr/bin/env yarn jest

import { GridProgram } from "./GridProgram"

describe(GridProgram, () => {
    it("can create a program", () => {
        const program = new GridProgram("test", "")
        expect(program.lines.length).toEqual(1)
    })

    it("can set values", () => {
        const program = new GridProgram("test", "title\thello world")
        expect(program.getLineValue("title")).toEqual("hello world")

        expect(
            program.setLineValue("title", "good morning").getLineValue("title")
        ).toEqual("good morning")
    })

    it("can find rows", () => {
        expect(
            new GridProgram(
                "test",
                `table\ntableName\ntable\tall\n`
            ).getRowNumbersStartingWith("table")
        ).toEqual([0, 2])
    })

    describe("blocks", () => {
        const program = new GridProgram(
            "test",
            `table
\tslug
\tcountry`
        )

        it("can get blocks", () => {
            expect(program.getBlock(0)).toEqual(`slug\ncountry`)
        })

        it("can search", () => {
            expect(program.getRowMatchingWords(undefined, "country")).toEqual(2)
            expect(program.getRowMatchingWords(undefined, "nada")).toEqual(-1)
        })

        it("can update blocks", () => {
            const newBlock = `slug\tname
country\tCountry`
            const newProgram = program.updateBlock(0, newBlock)
            expect(newProgram.getBlock(0)).toEqual(newBlock)
        })

        it("can delete blocks", () => {
            expect(program.deleteBlock(0).toString()).toEqual(`table`)

            const program2 = new GridProgram(
                "test",
                `table
\tslug
\tcountry
columns
\tone`
            )

            expect(program2.deleteBlock(3).toString()).toEqual(`table
\tslug
\tcountry
columns`)
        })
    })
})
