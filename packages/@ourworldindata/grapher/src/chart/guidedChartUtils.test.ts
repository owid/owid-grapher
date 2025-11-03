import { describe, it, expect } from "vitest"
import { Url } from "@ourworldindata/utils"
import {
    buildArchiveGuidedChartSrc,
    type ArchiveGuidedChartRegistration,
} from "./guidedChartUtils.js"
import { createRef } from "react"
import { ChartConfigType } from "@ourworldindata/types"

const makeRegistration = (
    baseUrl: string,
    defaultQueryParams: Record<string, string | undefined> = {}
): ArchiveGuidedChartRegistration => ({
    iframeRef: createRef<HTMLIFrameElement>(),
    baseUrl,
    defaultQueryParams,
    chartConfigType: ChartConfigType.Grapher,
})

describe(buildArchiveGuidedChartSrc, () => {
    it("merges guided query params over defaults", () => {
        const registration = makeRegistration(
            "https://archive.ourworldindata.org/grapher/test?tab=chart&stackMode=relative",
            { tab: "chart", stackMode: "relative" }
        )
        const guidedUrl = Url.fromURL(
            "https://ourworldindata.org/grapher/test?tab=map&stackMode=absolute"
        )

        const result = buildArchiveGuidedChartSrc(registration, guidedUrl)

        expect(result).toBe(
            "https://archive.ourworldindata.org/grapher/test?tab=map&stackMode=absolute"
        )
    })

    it("preserves default params when guided link omits them", () => {
        const registration = makeRegistration(
            "https://archive.ourworldindata.org/grapher/test?tab=chart&stackMode=relative",
            { tab: "chart", stackMode: "relative" }
        )
        const guidedUrl = Url.fromURL(
            "https://ourworldindata.org/grapher/test?tab=map"
        )

        const result = buildArchiveGuidedChartSrc(registration, guidedUrl)

        expect(result).toBe(
            "https://archive.ourworldindata.org/grapher/test?tab=map&stackMode=relative"
        )
    })

    it("includes hash fragments from guided link when present", () => {
        const registration = makeRegistration(
            "https://archive.ourworldindata.org/grapher/test?tab=chart",
            { tab: "chart" }
        )
        const guidedUrl = Url.fromURL(
            "https://ourworldindata.org/grapher/test?tab=map#scatterplot"
        )

        const result = buildArchiveGuidedChartSrc(registration, guidedUrl)

        expect(result).toBe(
            "https://archive.ourworldindata.org/grapher/test?tab=map#scatterplot"
        )
    })

    it("falls back to base hash when guided link omits one", () => {
        const registration = makeRegistration(
            "https://archive.ourworldindata.org/grapher/test?tab=chart#chart",
            { tab: "chart" }
        )
        const guidedUrl = Url.fromURL(
            "https://ourworldindata.org/grapher/test?stackMode=relative"
        )

        const result = buildArchiveGuidedChartSrc(registration, guidedUrl)

        expect(result).toBe(
            "https://archive.ourworldindata.org/grapher/test?tab=chart&stackMode=relative#chart"
        )
    })
})
