#! /usr/bin/env yarn jest
import { setupChart } from "test/utils"
import { CSVGenerator } from "charts/CSVGenerator"

function setupCSVGenerator(chartID: number, varIDs: number[]) {
    const chart = setupChart(chartID, varIDs)
    return new CSVGenerator({ chart })
}

function testIfCSVMatchesSnapshot(
    csvGenerator: CSVGenerator,
    done: jest.DoneCallback,
    matchUntilChar?: number
) {
    const blob = csvGenerator.csvBlob
    const reader = new FileReader()
    reader.addEventListener("loadend", () => {
        matchUntilChar
            ? expect(reader.result?.slice(0, matchUntilChar)).toMatchSnapshot()
            : expect(reader.result).toMatchSnapshot()

        done()
    })
    reader.readAsText(blob)
}

describe("CSV data downloads", () => {
    test("one year-based variable", done => {
        const csvGenerator = setupCSVGenerator(792, [3512])
        testIfCSVMatchesSnapshot(csvGenerator, done, 500)
    })

    test("one day-based variable, one year-based variable", done => {
        const chart = setupChart(4041, [142586, 2209, 123])
        chart.scatter.xOverrideYear = 2016
        testIfCSVMatchesSnapshot(new CSVGenerator({ chart }), done)
    })

    test("two day-based variables, one year-based variable", done => {
        const chart = setupChart(4058, [142600, 97587, 142583, 123])
        chart.scatter.xOverrideYear = 2100
        testIfCSVMatchesSnapshot(new CSVGenerator({ chart }), done)
    })

    test("two day-based variables", done => {
        const csvGenerator = setupCSVGenerator(4054, [142586, 142587, 123])
        testIfCSVMatchesSnapshot(csvGenerator, done)
    })
})
