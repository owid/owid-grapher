#! /usr/bin/env yarn tsn

// owid-covid-data.csv can be downloaded with:
// wget https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/owid-covid-data.csv

import { csvParse } from "d3-dsv"
import { CoreTable } from "coreTable/CoreTable"
import { MegaCsvToCovidExplorerTable } from "./MegaCsv"

import * as fs from "fs"
const megaCsvPath = __dirname + "/owid-covid-data.csv"
const getCsv = () => fs.readFileSync(megaCsvPath, "utf8")

export class Timer {
    constructor() {
        this._tickTime = Date.now()
        this._firstTickTime = this._tickTime
    }

    private _tickTime: number
    private _firstTickTime: number

    tick(msg?: string) {
        const elapsed = Date.now() - this._tickTime
        // eslint-disable-next-line no-console
        if (msg) console.log(`${elapsed}ms ${msg}`)
        this._tickTime = Date.now()
        return elapsed
    }

    getTotalElapsedTime() {
        return Date.now() - this._firstTickTime
    }
}

// Use this to get baseline perf with typing
// https://github.com/d3/d3-dsv/blob/master/src/autoType.js
const d3AutoType = (object: any) => {
    for (var key in object) {
        var value = object[key].trim(),
            number,
            m
        if (!value) value = null
        else if (value === "true") value = true
        else if (value === "false") value = false
        else if (value === "NaN") value = NaN
        else if (!isNaN((number = +value))) value = number
        else continue
        object[key] = value
    }
    return object
}

const main = () => {
    const timer = new Timer()
    timer.tick("start")
    const str = getCsv()
    timer.tick("file read")

    csvParse(str)
    timer.tick("csv parsed no types")

    csvParse(str, d3AutoType)
    timer.tick("csv parsed with types")

    new CoreTable(str)
    timer.tick("csv to core table")

    let table = MegaCsvToCovidExplorerTable(str)
    MegaCsvToCovidExplorerTable(str)
    timer.tick("csv to covid explorer table")
    table.dumpPipeline()
    timer.tick("dumped pipelin")

    table = MegaCsvToCovidExplorerTable(str).appendEveryColumn()
    timer.tick("csv to covid explorer table with every possible column")
    table.dumpPipeline()
    timer.tick("dumped pipelin")
}

main()
