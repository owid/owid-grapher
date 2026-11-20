import { expect, describe, it } from "vitest"
import { Bounds } from "@ourworldindata/utils"
import { GrapherState } from "../core/GrapherState"
import { GrapherProgrammaticInterface } from "../core/Grapher"
import { Footer, StaticFooter } from "./Footer"
import { FooterManager } from "./FooterManager"

interface FooterSizes {
    fontSize: number
    sourcesFontSize: number
    lineHeight: number
}

function readSizes(footer: Footer | StaticFooter): FooterSizes {
    return {
        fontSize: footer["fontSize"],
        sourcesFontSize: footer["sourcesFontSize"],
        lineHeight: footer["lineHeight"],
    }
}

function createStaticExport(
    bounds: Bounds,
    options: GrapherProgrammaticInterface
): GrapherState {
    const grapher = new GrapherState({
        bounds,
        staticBounds: bounds,
        ...options,
    })
    grapher.isExportingToSvgOrPng = true
    return grapher
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

describe("static export footer sizes", () => {
    it.each<[string, Bounds, GrapherProgrammaticInterface, FooterSizes]>([
        [
            "fixed layout",
            new Bounds(0, 0, 850, 600),
            {},
            { fontSize: 13, sourcesFontSize: 13, lineHeight: 1.2 },
        ],
        [
            "fixed layout with an explicit base font size",
            new Bounds(0, 0, 850, 600),
            { baseFontSize: 32 },
            { fontSize: 26, sourcesFontSize: 26, lineHeight: 1.2 },
        ],
        [
            "fixed small layout",
            new Bounds(0, 0, 328, 575),
            {},
            { fontSize: 14, sourcesFontSize: 14, lineHeight: 1.2 },
        ],
        [
            "responsive layout at phone width",
            new Bounds(0, 0, 328, 575),
            { isStaticLayoutResponsive: true },
            { fontSize: 11, sourcesFontSize: 12, lineHeight: 1.1 },
        ],
    ])("%s", (_, bounds, options, expected) => {
        const footer = new StaticFooter({
            manager: createStaticExport(bounds, options),
            targetX: 0,
            targetY: 0,
        })
        expect(readSizes(footer)).toEqual(expected)
    })
})
