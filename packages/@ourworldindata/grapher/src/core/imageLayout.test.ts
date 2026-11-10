import { describe, expect, it } from "vitest"
import { ChartLabelMode, GrapherVariant } from "@ourworldindata/types"
import { ImageLayout, resolveImageLayout } from "./imageLayout.js"
import { ImageRequest, parseImageRequest } from "./imageRequest.js"

function parse(query: string): ImageRequest {
    const result = parseImageRequest(new URLSearchParams(query))
    if (!result.ok) throw new Error(`${query}: ${result.error.reason}`)
    return result.request
}

type Size = [width: number, height: number]

interface LayoutCase {
    query: string
    png: Size
    svg: Size
    fontSize?: number
    variant?: GrapherVariant
    labelMode?: ChartLabelMode
    includeDetails?: boolean
}

function layoutOf(layout: ImageLayout): Pick<LayoutCase, "png" | "svg"> & {
    fontSize: number | undefined
} {
    return {
        png: [layout.pngWidth, layout.pngHeight],
        svg: [layout.svgWidth, layout.svgHeight],
        fontSize: layout.fontSize,
    }
}

const LAYOUT_CASES: Record<string, LayoutCase[]> = {
    "falls back to 850×600 and passes modifiers through": [
        { query: "", png: [850, 600], svg: [850, 600] },
        {
            query: "imDetails=1",
            png: [850, 600],
            svg: [850, 600],
            includeDetails: true,
        },
        {
            query: "imFontSize=12",
            png: [850, 600],
            svg: [850, 600],
            fontSize: 12,
        },
    ],
    "fills a missing dimension from the 850:600 aspect ratio, rounding the png":
        [
            { query: "imWidth=1000", png: [1000, 706], svg: [850, 600] },
            { query: "imHeight=500", png: [708, 500], svg: [850, 600] },
        ],
    "clamps the aspect ratio to 0.5–2": [
        {
            query: "imWidth=1000&imHeight=100",
            png: [1000, 500],
            svg: [1010, 505],
            fontSize: 20.2,
        },
        {
            query: "imWidth=100&imHeight=1000",
            png: [500, 1000],
            svg: [505, 1010],
            fontSize: 40.4,
        },
    ],
    "caps the png at 4250×3000 worth of pixels, after clamping": [
        {
            query: "imWidth=8500&imHeight=6000",
            png: [4250, 3000],
            svg: [850, 600],
        },
        {
            query: "imWidth=10000&imHeight=1000",
            png: [5050, 2525],
            svg: [1010, 505],
            fontSize: 20.2,
        },
    ],
    "scales the font with the svg height unless given": [
        {
            query: "imWidth=1200&imHeight=800",
            png: [1200, 800],
            svg: [875, 583],
            fontSize: 23.32,
        },
        {
            query: "imWidth=1200&imHeight=800&imFontSize=12",
            png: [1200, 800],
            svg: [875, 583],
            fontSize: 12,
        },
    ],
    "uncaptioned sizes like the default and honors imMinimal": [
        {
            query: "imType=uncaptioned",
            png: [850, 600],
            svg: [850, 600],
            variant: GrapherVariant.Uncaptioned,
        },
        {
            query: "imType=uncaptioned&imMinimal=1",
            png: [850, 600],
            svg: [850, 600],
            variant: GrapherVariant.Uncaptioned,
            labelMode: ChartLabelMode.Values,
        },
        {
            query: "imType=uncaptioned&imMinimal=0",
            png: [850, 600],
            svg: [850, 600],
            variant: GrapherVariant.Uncaptioned,
            labelMode: ChartLabelMode.All,
        },
        {
            query: "imType=uncaptioned&imWidth=1200&imHeight=800",
            png: [1200, 800],
            svg: [875, 583],
            fontSize: 23.32,
            variant: GrapherVariant.Uncaptioned,
        },
    ],
    "presets have a fixed size": [
        {
            query: "imType=twitter",
            png: [800, 418],
            svg: [800, 418],
            fontSize: 21,
        },
        { query: "imType=og", png: [1200, 628], svg: [800, 418], fontSize: 21 },
        { query: "imType=square", png: [2160, 2160], svg: [540, 540] },
    ],
    "thumbnails lay out at a quarter of the png size, without an aspect clamp":
        [
            {
                query: "imType=thumbnail",
                png: [1200, 640],
                svg: [300, 160],
                fontSize: 14,
                variant: GrapherVariant.Thumbnail,
            },
            {
                query: "imType=thumbnail&imWidth=4000&imHeight=400",
                png: [4000, 400],
                svg: [1000, 100],
                fontSize: 14,
                variant: GrapherVariant.Thumbnail,
            },
            {
                query: "imType=thumbnail&imWidth=800",
                png: [800, 640],
                svg: [200, 160],
                fontSize: 14,
                variant: GrapherVariant.Thumbnail,
            },
            {
                query: "imType=thumbnail&imFontSize=12",
                png: [1200, 640],
                svg: [300, 160],
                fontSize: 12,
                variant: GrapherVariant.Thumbnail,
            },
            {
                query: "imType=thumbnail&imMinimal=1",
                png: [1200, 640],
                svg: [300, 160],
                fontSize: 14,
                variant: GrapherVariant.Thumbnail,
                labelMode: ChartLabelMode.Values,
            },
            {
                query: "imType=thumbnail&imMinimal=0",
                png: [1200, 640],
                svg: [300, 160],
                fontSize: 14,
                variant: GrapherVariant.Thumbnail,
                labelMode: ChartLabelMode.All,
            },
        ],
}

describe("resolveImageLayout through the legacy aliases", () => {
    describe.each(Object.entries(LAYOUT_CASES))("%s", (_, cases) => {
        it.each(cases)("lays out '$query'", (testCase) => {
            const request = parse(testCase.query)
            expect(request.variant).toBe(
                testCase.variant ?? GrapherVariant.Default
            )
            expect(request.labelMode).toBe(
                testCase.labelMode ?? ChartLabelMode.All
            )
            expect(request.includeDetails).toBe(
                testCase.includeDetails ?? false
            )
            expect(layoutOf(resolveImageLayout(request))).toEqual({
                png: testCase.png,
                svg: testCase.svg,
                fontSize: testCase.fontSize,
            })
        })
    })
})
