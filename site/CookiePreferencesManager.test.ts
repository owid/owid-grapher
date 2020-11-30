#! /usr/bin/env jest

import {
    PreferenceType,
    parseRawCookieValue,
    parseDate,
    parsePreferences,
    updatePreference,
    getPreferenceValue,
    serializeState,
    arePreferencesOutdated,
} from "./CookiePreferencesManager"

describe("cookie preferences", () => {
    const preferences = [
        {
            type: PreferenceType.Analytics,
            value: true,
        },
    ]
    const date = 20201009
    const serializedState = "a:1-20201009"
    it("parses raw cookie value", () => {
        expect(parseRawCookieValue()).toBeUndefined()
        expect(parseRawCookieValue("")).toBeUndefined()
        expect(parseRawCookieValue("abcd")).toBeUndefined()
        expect(parseRawCookieValue("a:1")).toBeUndefined()
        expect(parseRawCookieValue("a:1-46")).toBeUndefined()
        expect(parseRawCookieValue("a:1-2020")).toBeUndefined()
        expect(parseRawCookieValue("1-20201009")).toBeUndefined()
        expect(parseRawCookieValue(":1-20201009")).toBeUndefined()
        expect(parseRawCookieValue("x:1-20201009")).toBeUndefined()
        expect(parseRawCookieValue(serializedState)).toEqual({
            preferences,
            date,
        })
    })
    it("parses date", () => {
        expect(parseDate()).toBeUndefined()
        expect(parseDate("")).toBeUndefined()
        expect(parseDate("abcd")).toBeUndefined()
        expect(parseDate("2020")).toBeUndefined()
        expect(parseDate("20201032")).toBeUndefined()
        expect(parseDate("20201001")).toEqual(20201001)
    })

    it("parses preferences", () => {
        expect(parsePreferences()).toEqual([])
        expect(parsePreferences("")).toEqual([])
        expect(parsePreferences("a:1")).toEqual(preferences)
        expect(parsePreferences("x:1")).toEqual([])
        expect(parsePreferences("a:1|m:0")).toEqual([
            ...preferences,
            { type: PreferenceType.Marketing, value: false },
        ])
    })

    it("updates a preference", () => {
        expect(
            updatePreference(PreferenceType.Analytics, false, preferences)
        ).toEqual([
            {
                type: PreferenceType.Analytics,
                value: false,
            },
        ])
    })

    it("gets a preference value", () => {
        expect(
            getPreferenceValue(PreferenceType.Analytics, preferences)
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
        expect(arePreferencesOutdated(date + 1, date)).toEqual(false)
        expect(arePreferencesOutdated(undefined, date)).toEqual(false)
    })
})
