#! /usr/bin/env yarn jest

import {
    CookiePreferenceType,
    getCookiePreference,
    updateCookiePreference,
} from "./CookiePreferences"

describe("gdpr consent", () => {
    it("gets consent values", () => {
        expect(
            getCookiePreference(CookiePreferenceType.Performance)
        ).toBeUndefined()
        expect(
            getCookiePreference(CookiePreferenceType.Performance, "")
        ).toBeUndefined()
        expect(
            getCookiePreference(CookiePreferenceType.Performance, "x:2")
        ).toBeUndefined()
        expect(
            getCookiePreference(CookiePreferenceType.Performance, "p:1|m:0")
        ).toEqual("1")
        expect(
            getCookiePreference(CookiePreferenceType.Performance, "p:13|m:2")
        ).toEqual("13")
        expect(
            getCookiePreference(CookiePreferenceType.Marketing, "p:1|m:2")
        ).toEqual("2")
    })

    it("sets consent values", () => {
        expect(
            updateCookiePreference(CookiePreferenceType.Performance, 0)
        ).toEqual("p:0")
        expect(
            updateCookiePreference(CookiePreferenceType.Performance, 0, "")
        ).toEqual("p:0")
        expect(
            updateCookiePreference(CookiePreferenceType.Marketing, 1, "p:1")
        ).toEqual("p:1|m:1")
    })

    it("updates consent values", () => {
        expect(
            updateCookiePreference(CookiePreferenceType.Performance, 0, "p:1")
        ).toEqual("p:0")
        expect(
            updateCookiePreference(
                CookiePreferenceType.Performance,
                0,
                "p:1|m:0|n:1"
            )
        ).toEqual("m:0|n:1|p:0")
        expect(
            updateCookiePreference(
                CookiePreferenceType.Performance,
                13,
                "p:1|m:0|n:1"
            )
        ).toEqual("m:0|n:1|p:13")
        expect(
            updateCookiePreference(
                CookiePreferenceType.Marketing,
                1,
                "p:1|m:0|n:1"
            )
        ).toEqual("p:1|n:1|m:1")
    })
})
