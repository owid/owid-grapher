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

        it("can update blocks", () => {
            const newBlock = `slug\tname
country\tCountry`
            const newProgram = program.updateBlock(0, newBlock)
            expect(newProgram.getBlock(0)).toEqual(newBlock)
        })
    })
})
