import { describe, expect, it } from "vitest"
import { ChartLabelMode, GrapherVariant } from "@ourworldindata/types"
import {
    DEFAULT_IMAGE_REQUEST,
    ImageRequest,
    parseImageRequest,
    serializeImageRequest,
} from "./imageRequest.js"

function parse(query: string): ImageRequest {
    const result = parseImageRequest(new URLSearchParams(query))
    if (!result.ok) throw new Error(`${query}: ${result.error.reason}`)
    return result.request
}

it("parses a query without image params to the default request", () => {
    expect(parse("country=FRA&tab=map")).toEqual(DEFAULT_IMAGE_REQUEST)
})

describe("new params", () => {
    it("gives the same request for imType=og and imPreset=og", () => {
        expect(parse("imPreset=og")).toEqual(parse("imType=og"))
    })

    it("gives the same request for imVariant=simplified&imLabels=values and the legacy thumbnail", () => {
        expect(parse("imVariant=simplified&imLabels=values")).toEqual(
            parse("imType=thumbnail&imMinimal=1")
        )
    })
})

it.each([ChartLabelMode.Names, ChartLabelMode.None])(
    "accepts imLabels=%s on a simplified image",
    (labelMode) => {
        expect(
            parse(`imVariant=simplified&imLabels=${labelMode}`)
        ).toMatchObject({ variant: GrapherVariant.Thumbnail, labelMode })
    }
)

describe(serializeImageRequest, () => {
    it("omits defaults, so the default request serializes to nothing", () => {
        expect(serializeImageRequest(parse("")).toString()).toBe("")
    })

    it("writes params in a fixed order", () => {
        const request: ImageRequest = {
            variant: GrapherVariant.Thumbnail,
            labelMode: ChartLabelMode.Values,
            includeDetails: false,
            size: { kind: "explicit", width: 1200, height: 640, fontSize: 12 },
        }
        expect(serializeImageRequest(request).toString()).toBe(
            "imVariant=simplified&imLabels=values&imWidth=1200&imHeight=640&imFontSize=12"
        )
    })

    it("writes only new params for a legacy query", () => {
        expect(
            serializeImageRequest(
                parse("imType=uncaptioned&imMinimal=1&imFontSize=16")
            ).toString()
        ).toBe("imVariant=uncaptioned&imLabels=values&imFontSize=16")
    })

    it.each<ImageRequest>([
        {
            variant: GrapherVariant.Default,
            labelMode: ChartLabelMode.All,
            size: { kind: "explicit" },
            includeDetails: false,
        },
        {
            variant: GrapherVariant.Default,
            labelMode: ChartLabelMode.All,
            size: { kind: "explicit", width: 1000, fontSize: 12 },
            includeDetails: true,
        },
        {
            variant: GrapherVariant.Default,
            labelMode: ChartLabelMode.All,
            size: { kind: "preset", preset: "twitter" },
            includeDetails: false,
        },
        {
            variant: GrapherVariant.Uncaptioned,
            labelMode: ChartLabelMode.Values,
            includeDetails: false,
            size: { kind: "explicit", width: 1200, height: 640 },
        },
        {
            variant: GrapherVariant.Thumbnail,
            labelMode: ChartLabelMode.Values,
            includeDetails: false,
            size: { kind: "explicit", height: 400 },
        },
    ])("round-trips %j", (request) => {
        expect(parse(serializeImageRequest(request).toString())).toEqual(
            request
        )
    })
})

describe("rejected image requests", () => {
    const ERROR_CASES: { query: string; param: string }[] = [
        { query: "imPreset=og&imFontSize=16", param: "imFontSize" },
        { query: "imType=twitter&imFontSize=16", param: "imFontSize" },
        { query: "imPreset=og&imDetails=1", param: "imDetails" },
        { query: "imType=square&imDetails=1", param: "imDetails" },
        { query: "imVariant=fancy", param: "imVariant" },
        { query: "imLabels=some", param: "imLabels" },
        { query: "imPreset=huge", param: "imPreset" },
        { query: "imDetails=2", param: "imDetails" },
        { query: "imMinimal=2", param: "imMinimal" },
        { query: "imWidth=abc", param: "imWidth" },
        { query: "imWidth=0", param: "imWidth" },
        { query: "imHeight=1.5", param: "imHeight" },
        { query: "imFontSize=-3", param: "imFontSize" },
        { query: "imType=unknown", param: "imType" },
        { query: "imType=thumbnail&imVariant=uncaptioned", param: "imType" },
        { query: "imType=og&imPreset=og", param: "imType" },
        { query: "imMinimal=1&imLabels=names", param: "imMinimal" },
        { query: "imMinimal=1", param: "imMinimal" },
        { query: "imVariant=uncaptioned&imLabels=names", param: "imLabels" },
        { query: "imVariant=uncaptioned&imLabels=none", param: "imLabels" },
        { query: "imLabels=names", param: "imLabels" },
        { query: "imLabels=none", param: "imLabels" },
        { query: "imPreset=og&imWidth=400", param: "imWidth" },
        { query: "imPreset=og&imHeight=400", param: "imHeight" },
        { query: "imType=twitter&imWidth=1700", param: "imWidth" },
        { query: "imPreset=og&imVariant=simplified", param: "imPreset" },
        { query: "imPreset=square&imVariant=uncaptioned", param: "imPreset" },
        { query: "imVariant=simplified&imDetails=1", param: "imDetails" },
        { query: "imType=thumbnail&imDetails=1", param: "imDetails" },
        {
            query: "imType=uncaptioned&imWidth=1200&imHeight=800&imDetails=1",
            param: "imDetails",
        },
    ]

    it.each(ERROR_CASES)("names $param for '$query'", ({ query, param }) => {
        const result = parseImageRequest(new URLSearchParams(query))
        expect(result).toMatchObject({ ok: false, error: { param } })
    })

    it("explains why a label mode is rejected", () => {
        expect(
            parseImageRequest(
                new URLSearchParams("imVariant=uncaptioned&imLabels=names")
            )
        ).toEqual({
            ok: false,
            error: {
                param: "imLabels",
                reason: "not allowed with imVariant=uncaptioned",
            },
        })
    })

    it("ignores grapher params", () => {
        expect(parse("country=FRA~DEU&tab=map&nocache")).toEqual(parse(""))
    })

    it("ignores unknown image params", () => {
        expect(parse("imFoo=1&imScale=4")).toEqual(parse(""))
        expect(parse("imType=square&imSquareSize=1080")).toEqual(
            parse("imPreset=square")
        )
    })
})
