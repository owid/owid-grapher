import { getPreferenceValue, PreferenceType } from "./cookiePreferences.js"

export const USER_SURVEY_MIN_VISIT_COUNT = 5
export const USER_SURVEY_RETURNING_USER_MIN_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

export const USER_SURVEY_FIRST_VISIT_TIMESTAMP_STORAGE_KEY =
    "owid.userSurvey.roleV1.firstVisitTimestampMs"
export const USER_SURVEY_VISIT_COUNT_STORAGE_KEY =
    "owid.userSurvey.roleV1.visitCount"
export const USER_SURVEY_ROLE_V1_RESPONSE_STORAGE_KEY =
    "owid.userSurvey.roleV1.response"

export type UserSurveyResponse = "answered" | "dismissed"

export function isUserSurveyEligible({
    hasAnalyticsConsent,
    response,
    visitCount,
    firstVisitTimestampMs,
    nowTimestampMs,
}: {
    hasAnalyticsConsent: boolean
    response: UserSurveyResponse | undefined
    visitCount: number
    firstVisitTimestampMs: number | undefined
    nowTimestampMs: number
}): boolean {
    if (!hasAnalyticsConsent) {
        return false
    }

    if (response) {
        return false
    }

    if (visitCount < USER_SURVEY_MIN_VISIT_COUNT) {
        return false
    }

    if (
        firstVisitTimestampMs === undefined ||
        nowTimestampMs - firstVisitTimestampMs <
            USER_SURVEY_RETURNING_USER_MIN_AGE_MS
    ) {
        return false
    }

    return true
}

export function getUserSurveyWidgetEligibility(
    nowTimestampMs: number = Date.now()
): boolean {
    const hasAnalyticsConsent = getPreferenceValue(PreferenceType.Analytics)
    const response = getUserSurveyResponse()

    if (!hasAnalyticsConsent) {
        return false
    }
    if (response) {
        return false
    }

    const visitCount = incrementAndGetUserSurveyVisitCount()
    const firstVisitTimestampMs =
        getOrSetUserSurveyFirstVisitTimestampMs(nowTimestampMs)

    return isUserSurveyEligible({
        hasAnalyticsConsent,
        response,
        visitCount,
        firstVisitTimestampMs,
        nowTimestampMs,
    })
}

export function markUserSurveyAnswered(): void {
    setUserSurveyResponse("answered")
}

export function markUserSurveyDismissed(): void {
    setUserSurveyResponse("dismissed")
}

function parseUserSurveyResponse(
    value: string | null
): UserSurveyResponse | undefined {
    if (value === "answered" || value === "dismissed") return value
    return undefined
}

function getUserSurveyResponse(): UserSurveyResponse | undefined {
    return parseUserSurveyResponse(
        getFromLocalStorage(USER_SURVEY_ROLE_V1_RESPONSE_STORAGE_KEY)
    )
}

function setUserSurveyResponse(response: UserSurveyResponse): void {
    setInLocalStorage(USER_SURVEY_ROLE_V1_RESPONSE_STORAGE_KEY, response)
}

function getUserSurveyVisitCount(): number {
    const value = getFromLocalStorage(USER_SURVEY_VISIT_COUNT_STORAGE_KEY)
    if (!value) return 0

    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 0) return 0
    return parsed
}

function setUserSurveyVisitCount(visitCount: number): void {
    setInLocalStorage(USER_SURVEY_VISIT_COUNT_STORAGE_KEY, String(visitCount))
}

function incrementAndGetUserSurveyVisitCount(): number {
    const currentVisitCount = getUserSurveyVisitCount()
    if (currentVisitCount >= USER_SURVEY_MIN_VISIT_COUNT) {
        return currentVisitCount
    }

    const nextVisitCount = currentVisitCount + 1
    setUserSurveyVisitCount(nextVisitCount)
    return nextVisitCount
}

function getUserSurveyFirstVisitTimestampMs(): number | undefined {
    const value = getFromLocalStorage(
        USER_SURVEY_FIRST_VISIT_TIMESTAMP_STORAGE_KEY
    )
    if (!value) return undefined

    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return undefined
    return parsed
}

function setUserSurveyFirstVisitTimestampMs(timestampMs: number): void {
    setInLocalStorage(
        USER_SURVEY_FIRST_VISIT_TIMESTAMP_STORAGE_KEY,
        String(timestampMs)
    )
}

function getOrSetUserSurveyFirstVisitTimestampMs(
    nowTimestampMs: number
): number {
    const firstVisitTimestampMs = getUserSurveyFirstVisitTimestampMs()
    if (firstVisitTimestampMs !== undefined) return firstVisitTimestampMs

    setUserSurveyFirstVisitTimestampMs(nowTimestampMs)
    return nowTimestampMs
}

function getFromLocalStorage(key: string): string | null {
    try {
        if (typeof window === "undefined") return null
        return window.localStorage.getItem(key)
    } catch {
        return null
    }
}

function setInLocalStorage(key: string, value: string): void {
    try {
        if (typeof window === "undefined") return
        window.localStorage.setItem(key, value)
    } catch {
        // ignore
    }
}
