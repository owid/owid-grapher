import { describe, it, expect, vi } from "vitest"
import {
    parseTabParam,
    parseOverlayParam,
    parseStackModeParam,
    parseBooleanOneZeroParam,
    parseScaleTypeParam,
    parseTimeParam,
    parseGlobeParam,
    parseGlobeRotationParam,
    parseGlobeZoomParam,
    parseRegionParam,
    parseEntityNamesParam,
    parseFocusParam,
    parseFacetParam,
    parseUniformYAxisParam,
    parseShowNoDataAreaParam,
    parseShowSelectionOnlyInTableParam,
    parseTableFilterParam,
    parseTableSearchParam,
    parseEndpointsOnlyParam,
    parseZoomToSelectionParam,
    parseGrapherQueryParams,
    logInvalidQueryParams,
    OVERLAY_PARAM_VALUES,
} from "./GrapherQueryParamParser"
import {
    FacetAxisDomain,
    FacetStrategy,
    GRAPHER_TAB_CONFIG_OPTIONS,
    MapRegionName,
    ScaleType,
    StackMode,
} from "@ourworldindata/types"
import { GrapherModal } from "./GrapherConstants"
import { DownloadModalTabName } from "../modal/DownloadModal"

describe("GrapherQueryParamParser", () => {
    describe("parseBooleanOneZeroParam", () => {
        it("returns valid(true) for '1'", () => {
            const result = parseBooleanOneZeroParam("1")
            expect(result).toEqual({ status: "valid", value: true })
        })

        it("returns valid(false) for '0'", () => {
            const result = parseBooleanOneZeroParam("0")
            expect(result).toEqual({ status: "valid", value: false })
        })

        it("returns missing for undefined", () => {
            const result = parseBooleanOneZeroParam(undefined)
            expect(result).toEqual({ status: "missing" })
        })

        it("returns invalid for other values", () => {
            const result = parseBooleanOneZeroParam("2")
            expect(result.status).toBe("invalid")
            if (result.status === "invalid") {
                expect(result.rawValue).toBe("2")
                expect(result.reason).toContain("Expected")
            }
        })
    })

    describe("parseScaleTypeParam", () => {
        it("parses 'linear' correctly", () => {
            const result = parseScaleTypeParam("linear")
            expect(result).toEqual({ status: "valid", value: ScaleType.linear })
        })

        it("parses 'log' correctly", () => {
            const result = parseScaleTypeParam("log")
            expect(result).toEqual({ status: "valid", value: ScaleType.log })
        })

        it("returns missing for undefined", () => {
            const result = parseScaleTypeParam(undefined)
            expect(result).toEqual({ status: "missing" })
        })

        it("returns invalid for unknown scale types", () => {
            const result = parseScaleTypeParam("exponential")
            expect(result.status).toBe("invalid")
        })
    })

    describe("parseTabParam", () => {
        it("parses valid tab values", () => {
            const result = parseTabParam("line")
            expect(result).toEqual({
                status: "valid",
                value: GRAPHER_TAB_CONFIG_OPTIONS.line,
            })
        })

        it("parses 'table' tab", () => {
            const result = parseTabParam("table")
            expect(result).toEqual({
                status: "valid",
                value: GRAPHER_TAB_CONFIG_OPTIONS.table,
            })
        })

        it("parses 'map' tab", () => {
            const result = parseTabParam("map")
            expect(result).toEqual({
                status: "valid",
                value: GRAPHER_TAB_CONFIG_OPTIONS.map,
            })
        })

        it("returns missing for undefined", () => {
            const result = parseTabParam(undefined)
            expect(result).toEqual({ status: "missing" })
        })

        it("returns invalid for unknown tabs", () => {
            const result = parseTabParam("unknown-tab")
            expect(result.status).toBe("invalid")
            if (result.status === "invalid") {
                expect(result.rawValue).toBe("unknown-tab")
            }
        })
    })

    describe("parseOverlayParam", () => {
        it("parses 'sources' overlay", () => {
            const result = parseOverlayParam(OVERLAY_PARAM_VALUES.sources)
            expect(result).toEqual({
                status: "valid",
                value: { modal: GrapherModal.Sources },
            })
        })

        it("parses 'download' overlay", () => {
            const result = parseOverlayParam(OVERLAY_PARAM_VALUES.download)
            expect(result).toEqual({
                status: "valid",
                value: { modal: GrapherModal.Download },
            })
        })

        it("parses 'download-data' overlay", () => {
            const result = parseOverlayParam(OVERLAY_PARAM_VALUES.downloadData)
            expect(result).toEqual({
                status: "valid",
                value: {
                    modal: GrapherModal.Download,
                    downloadTab: DownloadModalTabName.Data,
                },
            })
        })

        it("parses 'download-vis' overlay", () => {
            const result = parseOverlayParam(OVERLAY_PARAM_VALUES.downloadVis)
            expect(result).toEqual({
                status: "valid",
                value: {
                    modal: GrapherModal.Download,
                    downloadTab: DownloadModalTabName.Vis,
                },
            })
        })

        it("ignores 'embed' overlay for safety", () => {
            const result = parseOverlayParam("embed")
            expect(result.status).toBe("invalid")
        })

        it("returns missing for undefined", () => {
            const result = parseOverlayParam(undefined)
            expect(result).toEqual({ status: "missing" })
        })

        it("returns invalid for unknown overlays", () => {
            const result = parseOverlayParam("unknown")
            expect(result.status).toBe("invalid")
        })
    })

    describe("parseStackModeParam", () => {
        it("parses 'absolute'", () => {
            const result = parseStackModeParam("absolute")
            expect(result).toEqual({
                status: "valid",
                value: StackMode.absolute,
            })
        })

        it("parses 'relative'", () => {
            const result = parseStackModeParam("relative")
            expect(result).toEqual({
                status: "valid",
                value: StackMode.relative,
            })
        })

        it("returns invalid for unknown modes", () => {
            const result = parseStackModeParam("stacked")
            expect(result.status).toBe("invalid")
        })
    })

    describe("parseTimeParam", () => {
        it("parses time strings", () => {
            const result = parseTimeParam("2020")
            expect(result).toEqual({ status: "valid", value: "2020" })
        })

        it("parses time ranges", () => {
            const result = parseTimeParam("2000..2020")
            expect(result).toEqual({ status: "valid", value: "2000..2020" })
        })

        it("returns missing for empty string", () => {
            const result = parseTimeParam("")
            expect(result).toEqual({ status: "missing" })
        })

        it("returns missing for undefined", () => {
            const result = parseTimeParam(undefined)
            expect(result).toEqual({ status: "missing" })
        })
    })

    describe("parseGlobeParam", () => {
        it("parses '1' as true", () => {
            const result = parseGlobeParam("1")
            expect(result).toEqual({ status: "valid", value: true })
        })

        it("parses '0' as false", () => {
            const result = parseGlobeParam("0")
            expect(result).toEqual({ status: "valid", value: false })
        })
    })

    describe("parseGlobeRotationParam", () => {
        it("parses valid rotation", () => {
            const result = parseGlobeRotationParam("45,30")
            expect(result.status).toBe("valid")
            if (result.status === "valid") {
                // URL format is lat,lon but internal is [lon, lat]
                expect(result.value).toEqual([30, 45])
            }
        })

        it("returns missing for undefined", () => {
            const result = parseGlobeRotationParam(undefined)
            expect(result).toEqual({ status: "missing" })
        })
    })

    describe("parseGlobeZoomParam", () => {
        it("parses valid zoom level", () => {
            const result = parseGlobeZoomParam("2.5")
            expect(result).toEqual({ status: "valid", value: 2.5 })
        })

        it("returns invalid for non-numeric", () => {
            const result = parseGlobeZoomParam("abc")
            expect(result.status).toBe("invalid")
        })
    })

    describe("parseRegionParam", () => {
        it("parses valid regions", () => {
            const result = parseRegionParam("Europe")
            expect(result).toEqual({
                status: "valid",
                value: MapRegionName.Europe,
            })
        })

        it("parses 'World' region", () => {
            const result = parseRegionParam("World")
            expect(result).toEqual({
                status: "valid",
                value: MapRegionName.World,
            })
        })

        it("returns invalid for unknown regions", () => {
            const result = parseRegionParam("Antarctica")
            expect(result.status).toBe("invalid")
        })
    })

    describe("parseEntityNamesParam", () => {
        it("parses single entity", () => {
            const result = parseEntityNamesParam("~France")
            expect(result.status).toBe("valid")
            if (result.status === "valid") {
                expect(result.value).toContain("France")
            }
        })

        it("parses multiple entities", () => {
            const result = parseEntityNamesParam("France~Germany~Italy")
            expect(result.status).toBe("valid")
            if (result.status === "valid") {
                expect(result.value).toHaveLength(3)
            }
        })

        it("returns missing for undefined", () => {
            const result = parseEntityNamesParam(undefined)
            expect(result).toEqual({ status: "missing" })
        })
    })

    describe("parseFocusParam", () => {
        it("parses focus parameter", () => {
            const result = parseFocusParam("~France")
            expect(result.status).toBe("valid")
        })
    })

    describe("parseFacetParam", () => {
        it("parses 'none'", () => {
            const result = parseFacetParam("none")
            expect(result).toEqual({
                status: "valid",
                value: FacetStrategy.none,
            })
        })

        it("parses 'entity'", () => {
            const result = parseFacetParam("entity")
            expect(result).toEqual({
                status: "valid",
                value: FacetStrategy.entity,
            })
        })

        it("parses 'metric'", () => {
            const result = parseFacetParam("metric")
            expect(result).toEqual({
                status: "valid",
                value: FacetStrategy.metric,
            })
        })

        it("returns invalid for unknown facet strategies", () => {
            const result = parseFacetParam("unknown")
            expect(result.status).toBe("invalid")
        })
    })

    describe("parseUniformYAxisParam", () => {
        it("parses '0' as independent", () => {
            const result = parseUniformYAxisParam("0")
            expect(result).toEqual({
                status: "valid",
                value: FacetAxisDomain.independent,
            })
        })

        it("parses '1' as shared", () => {
            const result = parseUniformYAxisParam("1")
            expect(result).toEqual({
                status: "valid",
                value: FacetAxisDomain.shared,
            })
        })

        it("returns invalid for other values", () => {
            const result = parseUniformYAxisParam("2")
            expect(result.status).toBe("invalid")
        })
    })

    describe("parseShowNoDataAreaParam", () => {
        it("parses '1' as true", () => {
            const result = parseShowNoDataAreaParam("1")
            expect(result).toEqual({ status: "valid", value: true })
        })

        it("parses '0' as false", () => {
            const result = parseShowNoDataAreaParam("0")
            expect(result).toEqual({ status: "valid", value: false })
        })
    })

    describe("parseShowSelectionOnlyInTableParam (deprecated)", () => {
        it("parses '1' as 'selection'", () => {
            const result = parseShowSelectionOnlyInTableParam("1")
            expect(result).toEqual({ status: "valid", value: "selection" })
        })

        it("parses '0' as 'all'", () => {
            const result = parseShowSelectionOnlyInTableParam("0")
            expect(result).toEqual({ status: "valid", value: "all" })
        })
    })

    describe("parseTableFilterParam", () => {
        it("parses 'all'", () => {
            const result = parseTableFilterParam("all")
            expect(result).toEqual({ status: "valid", value: "all" })
        })

        it("parses 'selection'", () => {
            const result = parseTableFilterParam("selection")
            expect(result).toEqual({ status: "valid", value: "selection" })
        })

        it("returns invalid for unknown filters", () => {
            const result = parseTableFilterParam("invalid-filter")
            expect(result.status).toBe("invalid")
        })
    })

    describe("parseTableSearchParam", () => {
        it("parses search string", () => {
            const result = parseTableSearchParam("France")
            expect(result).toEqual({ status: "valid", value: "France" })
        })

        it("returns missing for empty string", () => {
            const result = parseTableSearchParam("")
            expect(result).toEqual({ status: "missing" })
        })
    })

    describe("parseEndpointsOnlyParam", () => {
        it("parses '1' as true", () => {
            const result = parseEndpointsOnlyParam("1")
            expect(result).toEqual({ status: "valid", value: true })
        })

        it("parses '0' as false", () => {
            const result = parseEndpointsOnlyParam("0")
            expect(result).toEqual({ status: "valid", value: false })
        })
    })

    describe("parseZoomToSelectionParam", () => {
        it("parses 'true' correctly", () => {
            const result = parseZoomToSelectionParam("true")
            expect(result).toEqual({ status: "valid", value: true })
        })
    })

    describe("parseGrapherQueryParams", () => {
        it("parses all parameters at once", () => {
            const result = parseGrapherQueryParams({
                tab: "line",
                overlay: "sources",
                stackMode: "relative",
                zoomToSelection: "true",
                xScale: "log",
                yScale: "linear",
                time: "2000..2020",
                globe: "1",
                region: "Europe",
                facet: "entity",
                uniformYAxis: "1",
                showNoDataArea: "1",
            })

            expect(result.tab).toEqual({
                status: "valid",
                value: GRAPHER_TAB_CONFIG_OPTIONS.line,
            })
            expect(result.overlay).toEqual({
                status: "valid",
                value: { modal: GrapherModal.Sources },
            })
            expect(result.stackMode).toEqual({
                status: "valid",
                value: StackMode.relative,
            })
            expect(result.zoomToSelection).toEqual({
                status: "valid",
                value: true,
            })
            expect(result.xScale).toEqual({
                status: "valid",
                value: ScaleType.log,
            })
            expect(result.yScale).toEqual({
                status: "valid",
                value: ScaleType.linear,
            })
            expect(result.time).toEqual({
                status: "valid",
                value: "2000..2020",
            })
            expect(result.globe).toEqual({ status: "valid", value: true })
            expect(result.region).toEqual({
                status: "valid",
                value: MapRegionName.Europe,
            })
            expect(result.facet).toEqual({
                status: "valid",
                value: FacetStrategy.entity,
            })
            expect(result.uniformYAxis).toEqual({
                status: "valid",
                value: FacetAxisDomain.shared,
            })
            expect(result.showNoDataArea).toEqual({
                status: "valid",
                value: true,
            })
        })

        it("handles empty params", () => {
            const result = parseGrapherQueryParams({})

            expect(result.tab).toEqual({ status: "missing" })
            expect(result.overlay).toEqual({ status: "missing" })
            expect(result.time).toEqual({ status: "missing" })
        })

        it("handles mixed valid and invalid params", () => {
            const result = parseGrapherQueryParams({
                tab: "line", // valid
                xScale: "invalid-scale", // invalid
                region: "InvalidRegion", // invalid
            })

            expect(result.tab.status).toBe("valid")
            expect(result.xScale.status).toBe("invalid")
            expect(result.region.status).toBe("invalid")
        })
    })

    describe("logInvalidQueryParams", () => {
        it("logs invalid parameters", () => {
            const consoleSpy = vi
                .spyOn(console, "error")
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                .mockImplementation(() => {})

            const parsed = parseGrapherQueryParams({
                xScale: "invalid",
                region: "BadRegion",
            })

            logInvalidQueryParams(parsed)

            expect(consoleSpy).toHaveBeenCalledTimes(2)
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("xScale")
            )
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("region")
            )

            consoleSpy.mockRestore()
        })

        it("does not log valid or missing parameters", () => {
            const consoleSpy = vi
                .spyOn(console, "error")
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                .mockImplementation(() => {})

            const parsed = parseGrapherQueryParams({
                tab: "line", // valid
                // time is missing
            })

            logInvalidQueryParams(parsed)

            expect(consoleSpy).not.toHaveBeenCalled()

            consoleSpy.mockRestore()
        })
    })
})
