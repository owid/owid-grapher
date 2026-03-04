import { describe, expect, it } from "vitest"
import {
    isUserSurveyEligible,
    USER_SURVEY_MIN_VISIT_COUNT,
    USER_SURVEY_RETURNING_USER_MIN_AGE_MS,
} from "./userSurvey.js"

const nowTimestampMs = 2_000_000

describe("user survey widget eligibility", () => {
    it("is ineligible when analytics consent is missing", () => {
        const result = isUserSurveyEligible({
            hasAnalyticsConsent: false,
            response: undefined,
            visitCount: USER_SURVEY_MIN_VISIT_COUNT,
            firstVisitTimestampMs:
                nowTimestampMs - USER_SURVEY_RETURNING_USER_MIN_AGE_MS,
            nowTimestampMs,
        })

        expect(result).toEqual(false)
    })

    it("is ineligible when user already answered or dismissed", () => {
        const result = isUserSurveyEligible({
            hasAnalyticsConsent: true,
            response: "dismissed",
            visitCount: USER_SURVEY_MIN_VISIT_COUNT,
            firstVisitTimestampMs:
                nowTimestampMs - USER_SURVEY_RETURNING_USER_MIN_AGE_MS,
            nowTimestampMs,
        })

        expect(result).toEqual(false)
    })

    it("is ineligible before the fifth visit", () => {
        const result = isUserSurveyEligible({
            hasAnalyticsConsent: true,
            response: undefined,
            visitCount: USER_SURVEY_MIN_VISIT_COUNT - 1,
            firstVisitTimestampMs:
                nowTimestampMs - USER_SURVEY_RETURNING_USER_MIN_AGE_MS,
            nowTimestampMs,
        })

        expect(result).toEqual(false)
    })

    it("is ineligible before 24 hours have passed since first visit", () => {
        const result = isUserSurveyEligible({
            hasAnalyticsConsent: true,
            response: undefined,
            visitCount: USER_SURVEY_MIN_VISIT_COUNT,
            firstVisitTimestampMs:
                nowTimestampMs - USER_SURVEY_RETURNING_USER_MIN_AGE_MS + 1,
            nowTimestampMs,
        })

        expect(result).toEqual(false)
    })

    it("is ineligible when first visit timestamp is unknown", () => {
        const result = isUserSurveyEligible({
            hasAnalyticsConsent: true,
            response: undefined,
            visitCount: USER_SURVEY_MIN_VISIT_COUNT,
            firstVisitTimestampMs: undefined,
            nowTimestampMs,
        })

        expect(result).toEqual(false)
    })

    it("is eligible when all conditions are met", () => {
        const result = isUserSurveyEligible({
            hasAnalyticsConsent: true,
            response: undefined,
            visitCount: USER_SURVEY_MIN_VISIT_COUNT,
            firstVisitTimestampMs:
                nowTimestampMs - USER_SURVEY_RETURNING_USER_MIN_AGE_MS,
            nowTimestampMs,
        })

        expect(result).toEqual(true)
    })
})
