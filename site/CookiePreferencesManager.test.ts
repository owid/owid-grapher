#! /usr/bin/env jest

import {
    PreferenceType,
    parseRawCookieValue,
    parseId,
    parsePreferences,
    updatePreference,
    getPreferenceValue,
    serializeState,
    isPolicyOutdated,
} from "./CookiePreferencesManager"

describe("cookie preferences", () => {
    const preferences = [
        {
            type: PreferenceType.Analytics,
            value: true,
        },
    ]
    const policyId = 20201009
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
            policyId,
        })
    })
    it("parses date", () => {
        expect(parseId()).toBeUndefined()
        expect(parseId("")).toBeUndefined()
        expect(parseId("abcd")).toBeUndefined()
        expect(parseId("2020")).toBeUndefined()
        expect(parseId("20201032")).toBeUndefined()
        expect(parseId("20201001")).toEqual(20201001)
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
        expect(serializeState({ preferences, policyId })).toEqual(
            serializedState
        )
    })

    it("checks if preferences are outdated", () => {
        expect(isPolicyOutdated(policyId - 1, policyId)).toEqual(true)
        expect(isPolicyOutdated(policyId, policyId)).toEqual(false)
        expect(isPolicyOutdated(policyId + 1, policyId)).toEqual(false)
        expect(isPolicyOutdated(undefined, policyId)).toEqual(false)
    })
})
