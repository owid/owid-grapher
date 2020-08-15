#! /usr/bin/env yarn jest

import { ExplorerProgram, SwitcherRuntime } from "../ExplorerProgram"

describe(ExplorerProgram, () => {
    const program = new ExplorerProgram(
        "test",
        ExplorerProgram.defaultExplorerProgram
    )
    it("gets the required chart ids", () => {
        expect(program.requiredChartIds).toEqual([35, 46])
    })

    it("gets code", () => {
        const expected = `chartId\tDevice
35\tInternet
46\tMobile`
        expect(program.switcherCode).toEqual(expected)
    })
})

describe("switcherCode", () => {
    const code = `chartId,country,indicator,interval,perCapita
21,usa,GDP,annual,FALSE
24,usa,GDP,annual,Per million
26,usa,GDP,monthly,
29,usa,Life expectancy,,
33,france,Life expectancy,,
55,spain,GDP,,FALSE
56,spain,GDP,,Per million`
    const options = new SwitcherRuntime(code)

    it("starts with a selected chart", () => {
        expect(options.chartId).toEqual(21)
        expect(options.toObject().country).toEqual("usa")
        expect(options.toObject().indicator).toEqual("GDP")
    })

    it("can detect needed chart configs", () => {
        expect(SwitcherRuntime.getRequiredChartIds(code)).toEqual([
            21,
            24,
            26,
            29,
            33,
            55,
            56
        ])
    })

    it("can detect unavailable options", () => {
        options.setValue("country", "france")
        expect(options.isOptionAvailable("indicator", "GDP")).toEqual(false)
        expect(options.isOptionAvailable("country", "france")).toEqual(true)
        expect(options.isOptionAvailable("interval", "annual")).toEqual(false)
        expect(options.isOptionAvailable("interval", "monthly")).toEqual(false)
        expect(options.toConstrainedOptions().indicator).toEqual(
            "Life expectancy"
        )
        expect(options.toConstrainedOptions().perCapita).toEqual(undefined)
        expect(options.toConstrainedOptions().interval).toEqual(undefined)
        expect(options.toObject().perCapita).toEqual("FALSE")
        expect(options.toObject().interval).toEqual("annual")
        expect(options.chartId).toEqual(33)
    })

    it("can handle boolean groups", () => {
        expect(options.isOptionAvailable("perCapita", "FALSE")).toEqual(false)
        options.setValue("country", "usa")
        options.setValue("perCapita", "Per million")
        expect(options.isOptionAvailable("perCapita", "FALSE")).toEqual(true)
        expect(options.chartId).toEqual(24)
    })

    it("can show available choices in a later group", () => {
        options.setValue("country", "spain")
        expect(options.isOptionAvailable("perCapita", "FALSE")).toEqual(true)
        expect(options.isOptionAvailable("perCapita", "Per million")).toEqual(
            true
        )
        expect(options.isOptionAvailable("interval", "annual")).toEqual(false)
        expect(options.chartId).toEqual(56)
    })

    it("returns groups with undefined values if invalid value is selected", () => {
        const options = new SwitcherRuntime(code)
        options.setValue("country", "usa")
        options.setValue("indicator", "GDP")
        options.setValue("interval", "annual")
        expect(options.groups[2].value).toEqual("annual")
        options.setValue("country", "spain")
        expect(options.groups[2].value).toEqual(undefined)
    })

    it("fails if no chartId column is provided", () => {
        try {
            new SwitcherRuntime(
                `country,indicator
usa,GDP
usa,Life expectancy
france,Life expectancy`,
                ""
            )
            expect(true).toBe(false)
        } catch (err) {
            expect(true).toBe(true)
        }
    })

    it("handles columns without options", () => {
        const options = new SwitcherRuntime(
            `chartId,country,indicator
123,usa,
32,usa,
23,france,`,
            ""
        )
        expect(options.chartId).toEqual(123)
        expect(options.groups.length).toBeGreaterThan(0)
    })

    it("handles empty options", () => {
        const options = new SwitcherRuntime(``, "")
        expect(options.groups.length).toEqual(0)
    })
})
