#! /usr/bin/env yarn jest

import {
    CookiePreferenceType,
    getPreference,
    updatePreference,
} from "./CookiePreferencesManager"

describe("gdpr consent", () => {
    it("gets consent values", () => {
        expect(getPreference(CookiePreferenceType.Performance)).toBeUndefined()
        expect(
            getPreference(CookiePreferenceType.Performance, "")
        ).toBeUndefined()
        expect(
            getPreference(CookiePreferenceType.Performance, "x:2")
        ).toBeUndefined()
        expect(
            getPreference(CookiePreferenceType.Performance, "p:1|v:0")
        ).toEqual(1)
        expect(
            getPreference(CookiePreferenceType.Performance, "p:13|v:2")
        ).toEqual(13)
        expect(getPreference(CookiePreferenceType.Version, "p:1|v:2")).toEqual(
            2
        )
    })

    it("sets consent values", () => {
        expect(updatePreference(CookiePreferenceType.Performance, 0)).toEqual(
            "p:0"
        )
        expect(
            updatePreference(CookiePreferenceType.Performance, 0, "")
        ).toEqual("p:0")
        expect(
            updatePreference(CookiePreferenceType.Version, 1, "p:1")
        ).toEqual("p:1|v:1")
    })

    it("updates consent values", () => {
        expect(
            updatePreference(CookiePreferenceType.Performance, 0, "p:1")
        ).toEqual("p:0")
        expect(
            updatePreference(CookiePreferenceType.Performance, 0, "p:1|v:0|n:1")
        ).toEqual("v:0|n:1|p:0")
        expect(
            updatePreference(
                CookiePreferenceType.Performance,
                13,
                "p:1|v:0|n:1"
            )
        ).toEqual("v:0|n:1|p:13")
        expect(
            updatePreference(CookiePreferenceType.Version, 1, "p:1|v:0|n:1")
        ).toEqual("p:1|n:1|v:1")
    })
})
