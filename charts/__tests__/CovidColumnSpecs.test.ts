#! /usr/bin/env yarn jest

import uniq from "lodash/uniq"
import { buildColumnSpec } from "charts/covidDataExplorer/CovidColumnSpecs"

describe(buildColumnSpec, () => {
    it("computes unique variable ids", () => {
        expect(
            uniq(
                [
                    buildColumnSpec("tests", 1000, true, 3),
                    buildColumnSpec("cases", 1000, true, 3),
                    buildColumnSpec("tests", 100, true, 3),
                    buildColumnSpec("tests", 1000, true, 0),
                    buildColumnSpec("tests", 1000, false, 3)
                ].map(spec => spec.owidVariableId)
            ).length
        ).toEqual(5)
    })
})
