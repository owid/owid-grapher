#! /usr/bin/env yarn jest

import { buildCovidVariableId } from "../covidDataExplorer/CovidDataUtils"
import uniq from "lodash/uniq"

describe(buildCovidVariableId, () => {
    it("computes unique variable ids", () => {
        expect(
            uniq([
                buildCovidVariableId("tests", 1000, 3, true),
                buildCovidVariableId("cases", 1000, 3, true),
                buildCovidVariableId("tests", 100, 3, true),
                buildCovidVariableId("tests", 1000, 0, true),
                buildCovidVariableId("tests", 1000, 3, false)
            ]).length
        ).toEqual(5)
    })
})
