#! /usr/bin/env yarn jest

import {
    DefaultExplorerProgram,
    ExplorerProgram,
    SwitcherRuntime,
} from "./ExplorerProgram"
import { getRequiredChartIds } from "./ExplorerUtils"

describe(ExplorerProgram, () => {
    const program = new ExplorerProgram("test", DefaultExplorerProgram)
    it("gets the required chart ids", () => {
        expect(program.requiredChartIds).toEqual([35, 46])
    })

    it("gets code", () => {
        const expected = `chartId\tDevice
35\tInternet
46\tMobile`
        expect(program.switcherCode).toEqual(expected)
    })

    it("allows blank lines in blocks", () => {
        const code = `title\tData Explorer
switcher
\tchartId\tDevice
\t35\tInternet

\t46\tMobile`
        expect(new ExplorerProgram("test", code).requiredChartIds).toEqual([
            35,
            46,
        ])
    })
})

describe(SwitcherRuntime, () => {
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

    it("it can get all options", () => {
        expect(options.allOptionsAsQueryStrings().length).toBe(7)
    })

    it("can detect needed chart configs", () => {
        expect(getRequiredChartIds(code)).toEqual([21, 24, 26, 29, 33, 55, 56])
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
        expect(options.choicesWithAvailability[2].value).toEqual("annual")
        options.setValue("country", "spain")
        expect(options.choicesWithAvailability[2].value).toEqual(undefined)
    })

    it("fails if no chartId column is provided", () => {
        try {
            new SwitcherRuntime(
                `country,indicator
usa,GDP
usa,Life expectancy
france,Life expectancy`
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
23,france,`
        )
        expect(options.chartId).toEqual(123)
        expect(options.choicesWithAvailability.length).toBeGreaterThan(0)
    })

    it("handles empty options", () => {
        const options = new SwitcherRuntime(``)
        expect(options.choicesWithAvailability.length).toEqual(0)
    })

    it("marks a radio as checked if its the only option", () => {
        const options = new SwitcherRuntime(
            `chartId,Gas,Accounting
488,CO₂,Production-based
4331,CO₂,Consumption-based
4147,GHGs,Production-based`
        )
        options.setValue("Gas", "CO₂")
        options.setValue("Accounting", "Consumption-based")
        options.setValue("Gas", "GHGs")
        expect(options.chartId).toEqual(4147)
        expect(options.toConstrainedOptions()["Accounting"]).toEqual(
            "Production-based"
        )
        expect(options.choicesWithAvailability[1].value).toEqual(
            "Production-based"
        )
        expect(options.choicesWithAvailability[1].options[0].value).toEqual(
            "Production-based"
        )
        expect(options.choicesWithAvailability[1].options[0].checked).toEqual(
            true
        )
    })
})
