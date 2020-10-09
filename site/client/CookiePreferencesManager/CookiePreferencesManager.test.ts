#! /usr/bin/env yarn jest

import {
    PreferenceType,
    parseRawCookieValue,
    parsePreferences,
    updatePreference,
    getPreferenceValue,
    serializeState,
    arePreferencesOutdated,
} from "./CookiePreferencesManager"

describe("cookie preferences", () => {
    const preferences = [
        {
            type: PreferenceType.Performance,
            value: true,
        },
    ]
    const date = 20201009
    const serializedState = "p:1-20201009"
    it("parses raw cookie value", () => {
        expect(parseRawCookieValue()).toBeUndefined()
        expect(parseRawCookieValue("")).toBeUndefined()
        expect(parseRawCookieValue(serializedState)).toEqual({
            preferences,
            date,
        })
    })

    it("parses preferences", () => {
        expect(parsePreferences("p:1")).toEqual(preferences)
        expect(parsePreferences("p:1|m:0")).toEqual([
            ...preferences,
            { type: PreferenceType.Marketing, value: false },
        ])
    })

    it("updates a preference", () => {
        expect(
            updatePreference(PreferenceType.Performance, false, preferences)
        ).toEqual([
            {
                type: PreferenceType.Performance,
                value: false,
            },
        ])
    })

    it("gets a preference value", () => {
        expect(
            getPreferenceValue(PreferenceType.Performance, preferences)
        ).toEqual(true)
        expect(
            getPreferenceValue(PreferenceType.Marketing, preferences)
        ).toEqual(false)
    })

    it("serializes state", () => {
        expect(serializeState({ preferences, date })).toEqual(serializedState)
    })

    it("checks if preferences are outdated", () => {
        expect(arePreferencesOutdated(date - 1, date)).toEqual(true)
        expect(arePreferencesOutdated(date, date)).toEqual(false)
        expect(arePreferencesOutdated(undefined, date)).toEqual(false)
    })

    // it("gets consent values", () => {
    //     expect(getPreference(PreferenceType.Performance)).toBeUndefined()
    //     expect(getPreference(PreferenceType.Performance, "")).toBeUndefined()
    //     expect(getPreference(PreferenceType.Performance, "x:2")).toBeUndefined()
    //     expect(getPreference(PreferenceType.Performance, "p:1|v:0")).toEqual(1)
    //     expect(getPreference(PreferenceType.Performance, "p:13|v:2")).toEqual(
    //         13
    //     )
    //     expect(getPreference(PreferenceType.Version, "p:1|v:2")).toEqual(2)
    // })

    // it("sets consent values", () => {
    //     expect(updatePreference(PreferenceType.Performance, 0)).toEqual("p:0")
    //     expect(updatePreference(PreferenceType.Performance, 0, "")).toEqual(
    //         "p:0"
    //     )
    //     expect(updatePreference(PreferenceType.Version, 1, "p:1")).toEqual(
    //         "p:1|v:1"
    //     )
    // })

    // it("updates consent values", () => {
    //     expect(updatePreference(PreferenceType.Performance, 0, "p:1")).toEqual(
    //         "p:0"
    //     )
    //     expect(
    //         updatePreference(PreferenceType.Performance, 0, "p:1|v:0|n:1")
    //     ).toEqual("v:0|n:1|p:0")
    //     expect(
    //         updatePreference(PreferenceType.Performance, 13, "p:1|v:0|n:1")
    //     ).toEqual("v:0|n:1|p:13")
    //     expect(
    //         updatePreference(PreferenceType.Version, 1, "p:1|v:0|n:1")
    //     ).toEqual("p:1|n:1|v:1")
    // })
})
