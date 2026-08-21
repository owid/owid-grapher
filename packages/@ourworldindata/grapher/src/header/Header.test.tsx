import { expect, describe, it } from "vitest"
import { TextWrapGroup } from "@ourworldindata/components"
import { Header } from "./Header"
import { HeaderManager } from "./HeaderManager"

const TITLE_ANNOTATION = "United Kingdom, 1990 to 2023"

// A default-sized header starts out with a 25px title and shrinks it by no
// more than 15% in 0.5px steps, i.e. down to 21.5px, to make the title fit
const INITIAL_FONT_SIZE = 25
const SMALLEST_FONT_SIZE = 21.5

function makeTitle(
    mainTitle: string,
    maxWidth: number,
    manager: HeaderManager = {}
): TextWrapGroup {
    const header = new Header({
        maxWidth,
        manager: {
            mainTitle,
            titleAnnotation: TITLE_ANNOTATION,
            hideLogo: true,
            ...manager,
        },
    })
    return header.title
}

describe("title", () => {
    it("keeps the initial font size if the title fits on a single line", () => {
        const title = makeTitle("Historical trade openness in Europe", 760)
        expect(title.fontSize).toEqual(INITIAL_FONT_SIZE)
        expect(title.lineCount).toEqual(1)
    })

    it("shrinks the title as little as possible to fit it on a single line", () => {
        // The title and its annotation need two lines at 24px, but fit on one
        // at 23.5px
        const title = makeTitle("Lung cancer death rates", 540)
        expect(title.fontSize).toEqual(23.5)
        expect(title.lineCount).toEqual(1)
    })

    it("keeps the main title on one line and moves the annotation to its own line", () => {
        // The main title alone doesn't fit on one line until 23px
        const title = makeTitle("Average height of men by decade of birth", 460)
        expect(title.fontSize).toEqual(23)
        expect(title.lineCount).toEqual(2)
        expect(title.fragmentLineCounts).toEqual([1, 1])
    })

    it("shrinks the title as little as possible to reduce the number of lines", () => {
        // The title spans four lines down to 23px, and three from 22.5px
        const title = makeTitle(
            "Share of the population with no formal education with projections",
            380
        )
        expect(title.fontSize).toEqual(22.5)
        expect(title.lineCount).toEqual(3)
        expect(title.fragmentLineCounts).toEqual([2, 1])
    })

    it("uses the smallest font size if shrinking doesn't save a line", () => {
        // This title spans three lines at every font size we're willing to use
        const title = makeTitle("Historical trade openness in Europe", 300)
        expect(title.fontSize).toEqual(SMALLEST_FONT_SIZE)
        expect(title.lineCount).toEqual(3)
    })

    it("keeps font sizes on 0.5px steps for a custom base font size", () => {
        // A base font size of 16.67 scales the title up to 26.05px
        const manager: HeaderManager = {
            useBaseFontSize: true,
            fontSize: 16.67,
        }
        expect(
            makeTitle("Historical trade openness in Europe", 760, manager)
                .fontSize
        ).toEqual(26)
        expect(
            makeTitle("Lung cancer death rates", 540, manager).fontSize
        ).toEqual(23.5)
    })
})
