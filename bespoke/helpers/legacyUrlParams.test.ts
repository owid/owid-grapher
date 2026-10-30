import { afterEach, describe, expect, it, vi } from "vitest"

import {
    migrateLegacyUrlParams,
    renameLegacyQueryParams,
} from "./legacyUrlParams.js"

const LEGACY_NAMES = new Map([
    ["demographyCountry", "country"],
    ["demographyAge", "age"],
])

describe(renameLegacyQueryParams, () => {
    it("renames a legacy param and keeps its value", () => {
        expect(
            renameLegacyQueryParams("?demographyCountry=France", LEGACY_NAMES)
        ).toEqual("?country=France")
    })

    it("lets the current value win when both names are present", () => {
        expect(
            renameLegacyQueryParams(
                "?demographyCountry=France&country=Chad",
                LEGACY_NAMES
            )
        ).toEqual("?country=Chad")
    })

    it("keeps unrelated params in order next to a renamed one", () => {
        expect(
            renameLegacyQueryParams(
                "?a=x%20y&demographyAge=30&b=1+2",
                LEGACY_NAMES
            )
        ).toEqual("?a=x+y&age=30&b=1+2")
    })

    it("returns a query with no legacy params unchanged, and its own output as a no-op", () => {
        const untouched = "?a=x%20y&b=1+2"
        expect(renameLegacyQueryParams(untouched, LEGACY_NAMES)).toBe(untouched)

        const migrated = renameLegacyQueryParams(
            "?demographyAge=30",
            LEGACY_NAMES
        )
        expect(renameLegacyQueryParams(migrated, LEGACY_NAMES)).toBe(migrated)
    })
})

describe(migrateLegacyUrlParams, () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    function stubWindow(location: {
        pathname: string
        search: string
        hash: string
    }): ReturnType<typeof vi.fn> {
        const replaceState = vi.fn()
        vi.stubGlobal("window", {
            location,
            history: { state: { id: 1 }, replaceState },
        })
        return replaceState
    }

    it("does not touch the history when nothing changes", () => {
        const replaceState = stubWindow({
            pathname: "/demography",
            search: "?a=1",
            hash: "#chart",
        })
        migrateLegacyUrlParams(LEGACY_NAMES)
        expect(replaceState).not.toHaveBeenCalled()
    })

    it("replaces the URL with current names and preserves path and hash", () => {
        const replaceState = stubWindow({
            pathname: "/demography",
            search: "?demographyCountry=France",
            hash: "#chart",
        })
        migrateLegacyUrlParams(LEGACY_NAMES)
        expect(replaceState).toHaveBeenCalledWith(
            { id: 1 },
            "",
            "/demography?country=France#chart"
        )
    })
})
