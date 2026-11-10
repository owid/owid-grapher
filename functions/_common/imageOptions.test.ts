import { describe, expect, it } from "vitest"
import { ChartLabelMode, GrapherVariant } from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"
import { extractOptions, ImageOptions } from "./imageOptions.js"

interface ImageOptionsCase {
    query: string
    expected: ImageOptions
}

type Size = [width: number, height: number]

function makeGenericOptions(
    [pngWidth, pngHeight]: Size,
    [svgWidth, svgHeight]: Size,
    extra: Partial<ImageOptions> = {}
): ImageOptions {
    return {
        pngWidth,
        pngHeight,
        svgWidth,
        svgHeight,
        details: false,
        fontSize: undefined,
        ...extra,
    }
}

function makeThumbnail(
    svgWidth: number,
    svgHeight: number,
    {
        fontSize = 14,
        labelMode,
    }: { fontSize?: number; labelMode?: ChartLabelMode } = {}
): ImageOptions {
    return {
        pngWidth: 4 * svgWidth,
        pngHeight: 4 * svgHeight,
        svgWidth,
        svgHeight,
        details: false,
        fontSize,
        grapherProps: {
            staticBounds: new Bounds(0, 0, svgWidth, svgHeight),
            variant: GrapherVariant.Thumbnail,
            ...(labelMode !== undefined && { labelMode }),
        },
    }
}

const DEFAULT = makeGenericOptions([850, 600], [850, 600])

const TWITTER = makeGenericOptions([800, 418], [800, 418], { fontSize: 21 })

const OPEN_GRAPH = makeGenericOptions([1200, 628], [800, 418], {
    fontSize: 21,
})

const SQUARE = makeGenericOptions([2160, 2160], [540, 540], {
    grapherProps: { staticBounds: new Bounds(0, 0, 540, 540) },
})

const CASES: Record<string, ImageOptionsCase[]> = {
    "falls back to 850×600 and passes modifiers through": [
        { query: "", expected: DEFAULT },
        { query: "imType=unknown", expected: DEFAULT },
        { query: "imMinimal=1", expected: DEFAULT },
        { query: "imDetails=1", expected: { ...DEFAULT, details: true } },
        { query: "imFontSize=12", expected: { ...DEFAULT, fontSize: 12 } },
    ],
    "fills a missing dimension from the 850:600 aspect ratio, rounding the png":
        [
            {
                query: "imWidth=1000",
                expected: makeGenericOptions([1000, 706], [850, 600]),
            },
            {
                query: "imHeight=500",
                expected: makeGenericOptions([708, 500], [850, 600]),
            },
        ],
    "clamps the aspect ratio to 0.5–2": [
        {
            query: "imWidth=1000&imHeight=100",
            expected: makeGenericOptions([1000, 500], [1010, 505], {
                fontSize: 20.2,
            }),
        },
        {
            query: "imWidth=100&imHeight=1000",
            expected: makeGenericOptions([500, 1000], [505, 1010], {
                fontSize: 40.4,
            }),
        },
    ],
    "caps the png at 4250×3000 worth of pixels, after clamping": [
        {
            query: "imWidth=8500&imHeight=6000",
            expected: makeGenericOptions([4250, 3000], [850, 600]),
        },
        {
            query: "imWidth=10000&imHeight=1000",
            expected: makeGenericOptions([5050, 2525], [1010, 505], {
                fontSize: 20.2,
            }),
        },
    ],
    "scales the font with the svg height unless given": [
        {
            query: "imWidth=1200&imHeight=800",
            expected: makeGenericOptions([1200, 800], [875, 583], {
                fontSize: 23.32,
            }),
        },
        {
            query: "imWidth=1200&imHeight=800&imFontSize=12",
            expected: makeGenericOptions([1200, 800], [875, 583], {
                fontSize: 12,
            }),
        },
    ],
    "uncaptioned sizes like the default and honors imMinimal": [
        {
            query: "imType=uncaptioned",
            expected: {
                ...DEFAULT,
                grapherProps: { variant: GrapherVariant.Uncaptioned },
            },
        },
        {
            query: "imType=uncaptioned&imMinimal=1",
            expected: {
                ...DEFAULT,
                grapherProps: {
                    variant: GrapherVariant.Uncaptioned,
                    labelMode: ChartLabelMode.Values,
                },
            },
        },
        {
            query: "imType=uncaptioned&imMinimal=0",
            expected: {
                ...DEFAULT,
                grapherProps: {
                    variant: GrapherVariant.Uncaptioned,
                    labelMode: ChartLabelMode.All,
                },
            },
        },
        {
            query: "imType=uncaptioned&imWidth=1200&imHeight=800&imDetails=1",
            expected: makeGenericOptions([1200, 800], [875, 583], {
                details: true,
                fontSize: 23.32,
                grapherProps: { variant: GrapherVariant.Uncaptioned },
            }),
        },
    ],
    "presets have a fixed size and ignore the size, font and details params": [
        { query: "imType=twitter", expected: TWITTER },
        {
            query: "imType=twitter&imWidth=1700&imFontSize=12&imDetails=1",
            expected: TWITTER,
        },
        { query: "imType=og", expected: OPEN_GRAPH },
        {
            query: "imType=og&imWidth=1700&imFontSize=12&imDetails=1",
            expected: OPEN_GRAPH,
        },
        { query: "imType=square", expected: SQUARE },
        {
            query: "imType=square&imWidth=1700&imFontSize=12&imDetails=1",
            expected: SQUARE,
        },
        {
            query: "imType=square&imSquareSize=1080",
            expected: SQUARE,
        },
    ],
    "thumbnails lay out at a quarter of the png size, without an aspect clamp":
        [
            { query: "imType=thumbnail", expected: makeThumbnail(300, 160) },
            {
                query: "imType=thumbnail&imWidth=4000&imHeight=400",
                expected: makeThumbnail(1000, 100),
            },
            {
                query: "imType=thumbnail&imWidth=800",
                expected: makeThumbnail(200, 160),
            },
            {
                query: "imType=thumbnail&imFontSize=12",
                expected: makeThumbnail(300, 160, { fontSize: 12 }),
            },
            {
                query: "imType=thumbnail&imDetails=1",
                expected: makeThumbnail(300, 160),
            },
            {
                query: "imType=thumbnail&imMinimal=1",
                expected: makeThumbnail(300, 160, {
                    labelMode: ChartLabelMode.Values,
                }),
            },
            {
                query: "imType=thumbnail&imMinimal=0",
                expected: makeThumbnail(300, 160, {
                    labelMode: ChartLabelMode.All,
                }),
            },
        ],
}

describe(extractOptions, () => {
    describe.each(Object.entries(CASES))("%s", (_, cases) => {
        it.each(cases)("maps '$query'", ({ query, expected }) => {
            expect(extractOptions(new URLSearchParams(query))).toEqual(expected)
        })
    })
})
