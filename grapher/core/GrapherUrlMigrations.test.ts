#! /usr/bin/env jest

import { legacyToCurrentGrapherQueryParams } from "./GrapherUrlMigrations"

describe(legacyToCurrentGrapherQueryParams, () => {
    it("handles 'modern' query params containing '&'", () => {
        const queryStr = "?tab=chart&country=~East+Asia+%26+Pacific"

        const currentQueryParams = legacyToCurrentGrapherQueryParams(queryStr)

        expect(currentQueryParams).toEqual({
            selection: "East Asia & Pacific",
            tab: "chart",
        })
    })

    it("handles legacy query params containing '&'", () => {
        const legacyQueryStr = "?tab=chart&country=East%20Asia%20%26%20Pacific"

        const currentQueryParams = legacyToCurrentGrapherQueryParams(
            legacyQueryStr
        )

        expect(currentQueryParams).toEqual({
            selection: "East Asia & Pacific",
            tab: "chart",
        })
    })
})
