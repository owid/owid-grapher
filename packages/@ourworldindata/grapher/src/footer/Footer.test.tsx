import { expect, describe, it } from "vitest"
import { Footer, StaticFooter } from "./Footer"
import { FooterManager } from "./FooterManager"

interface FooterSizes {
    fontSize: number
    sourcesFontSize: number
    lineHeight: number
}

function readSizes(footer: Footer): FooterSizes {
    return {
        fontSize: footer["fontSize"],
        sourcesFontSize: footer["sourcesFontSize"],
        lineHeight: footer["lineHeight"],
    }
}

describe("live footer sizes", () => {
    it.each<[string, Partial<FooterManager>, FooterSizes]>([
        ["wide", {}, { fontSize: 12, sourcesFontSize: 13, lineHeight: 1.2 }],
        [
            "medium",
            { isMedium: true },
            { fontSize: 11, sourcesFontSize: 13, lineHeight: 1.2 },
        ],
        [
            "small",
            { isMedium: true, isSmall: true },
            { fontSize: 11, sourcesFontSize: 12, lineHeight: 1.1 },
        ],
        [
            "an explicit base font size",
            { useBaseFontSize: true, fontSize: 32 },
            { fontSize: 22, sourcesFontSize: 24, lineHeight: 1.2 },
        ],
    ])("%s", (_, manager, expected) => {
        const footer = new Footer({ manager: manager as FooterManager })
        expect(readSizes(footer)).toEqual(expected)
    })
})

describe("static footer sizes", () => {
    it.each<[string, Partial<FooterManager>, FooterSizes]>([
        [
            "fixed layout",
            { isLayoutFixed: true },
            { fontSize: 13, sourcesFontSize: 13, lineHeight: 1.2 },
        ],
        [
            "fixed layout with an explicit base font size",
            { isLayoutFixed: true, useBaseFontSize: true, fontSize: 32 },
            { fontSize: 26, sourcesFontSize: 26, lineHeight: 1.2 },
        ],
        [
            "fixed small layout",
            { isLayoutFixed: true, isStaticAndSmall: true },
            { fontSize: 14, sourcesFontSize: 14, lineHeight: 1.2 },
        ],
        [
            "responsive layout",
            { isMedium: true, isSmall: true },
            { fontSize: 11, sourcesFontSize: 12, lineHeight: 1.1 },
        ],
    ])("%s", (_, manager, expected) => {
        const footer = new StaticFooter({
            manager: manager as FooterManager,
            targetX: 0,
            targetY: 0,
        })
        expect(readSizes(footer)).toEqual(expected)
    })
})
