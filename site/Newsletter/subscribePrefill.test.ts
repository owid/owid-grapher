/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest"
import {
    storeSubscribePrefill,
    takeSubscribePrefill,
} from "./subscribePrefill.js"

describe("subscribe prefill hand-off", () => {
    it("is read once and then cleared", () => {
        storeSubscribePrefill({ email: "a@b.c", subscribeToOwidBrief: false })
        expect(takeSubscribePrefill()).toEqual({
            email: "a@b.c",
            subscribeToOwidBrief: false,
        })
        expect(takeSubscribePrefill()).toBe(undefined)
    })

    it("ignores garbage", () => {
        sessionStorage.setItem("owid-subscribe-prefill", "{not json")
        expect(takeSubscribePrefill()).toBe(undefined)
        sessionStorage.setItem("owid-subscribe-prefill", "{}")
        expect(takeSubscribePrefill()).toBe(undefined)
    })
})
