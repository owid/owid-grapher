import * as Sentry from "@sentry/react"
import { isInIFrame } from "@ourworldindata/utils"
import { getAnalyticsConsentValue, parseCookies } from "./cookieTools.js"
import tests from "./ab-tests.json" with { type: "json" }

export const abTest = async (context) => {
    const originalResponse = await context.next()
    const cookies = parseCookies(context.request)

    if (tests && tests.length && !isInIFrame()) {
        const analyticsConsent = getAnalyticsConsentValue(context.request)
        console.log(analyticsConsent)
        const replay = Sentry.getReplay()
        let isReplayRecording = !!replay.getReplayId()
        tests.map((test) => {
            if (
                !cookies ||
                !Object.prototype.hasOwnProperty.call(cookies, test["id"])
            ) {
                // todo: what if cumul doesn't sum to 1?
                let cumul = 0
                test["arms"].map((arm) => {
                    cumul += arm["size"]
                    arm["cumulSize"] = cumul
                })
                // assign visitor to an experimental arm
                const percentage = Math.random()
                let assignedArm
                for (const arm of test["arms"]) {
                    const assignToArm =
                        arm["cumulSize"] - arm["size"] <= percentage &&
                        percentage < arm["cumulSize"]
                    if (assignToArm) {
                        assignedArm = arm
                        break
                    }
                }
                const expiresAt = test["expires"]
                    ? new Date(test["expires"])
                    : new Date(Date.now() + 7 * (24 * 60 * 60 * 1000)) // fallback: cookie expires in 7 days
                if (assignedArm) {
                    originalResponse.headers.append(
                        "Set-Cookie",
                        `${test["id"]}=${assignedArm["id"]}; expires=${expiresAt.toUTCString()}; path=/grapher/`
                    )
                    if (
                        analyticsConsent &&
                        !isReplayRecording &&
                        assignedArm["replaysSessionSampleRate"]
                    ) {
                        // if user has accepted cookies and replay is not already recording, record this session replay with
                        // probability 0 < p < 1 = arm's replaysSessionSampleRate.
                        const p = Math.random()
                        if (p < assignedArm["replaysSessionSampleRate"]) {
                            isReplayRecording = true
                            replay.start()
                        }
                    }
                }
            }
        })

        return originalResponse
    }

    return originalResponse
}
