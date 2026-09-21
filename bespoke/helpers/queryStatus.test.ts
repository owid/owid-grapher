import { describe, expect, it } from "vitest"

import { combineStatuses } from "./queryStatus.js"

describe(combineStatuses, () => {
    it("reports error even when another query is still pending", () => {
        expect(combineStatuses("pending", "error")).toEqual("error")
    })

    it("reports pending until every query has settled", () => {
        expect(combineStatuses("success", "pending")).toEqual("pending")
    })

    it("reports success once every query has succeeded", () => {
        expect(combineStatuses("success", "success")).toEqual("success")
    })

    it("reports success for no queries at all", () => {
        expect(combineStatuses()).toEqual("success")
    })
})
