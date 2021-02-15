#! /usr/bin/env jest

import { legacyToCurrentGrapherQueryParams } from "./GrapherUrlMigrations"

describe(legacyToCurrentGrapherQueryParams, () => {
    it("handles legacy query params containing '&'", () => {
        const legacyQueryParams = {
            tab: "chart",
            country: "East Asia & Pacific",
        }

        const currentQueryStr = legacyToCurrentGrapherQueryParams(
            legacyQueryParams
        )

        expect(currentQueryStr).toEqual({
            selection: "East Asia & Pacific",
            tab: "chart",
        })
    })
})
