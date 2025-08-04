import * as Sentry from "@sentry/react"
import { isInIFrame } from "@ourworldindata/utils"
import {
    getAnalyticsConsentValue,
    parseCookies,
} from "../_common/cookieTools.js"
import { Experiment, validateUniqueExperimentIds } from "./Experiment.js"
import { Arm } from "./types.js"
import { experiments } from "./config.js"

export const experimentsMiddleware = async (context) => {
    const originalResponse = await context.next()
    const cookies = parseCookies(context.request)

    const activeExperiments = experiments.filter((e) => !e.isExpired())

    if (activeExperiments && activeExperiments.length && !isInIFrame()) {
        if (!validateUniqueExperimentIds(activeExperiments)) {
            throw new Error(`Experiment IDs are not unique`)
        }

        const analyticsConsent = getAnalyticsConsentValue(context.request)
        const replay = Sentry.getReplay()
        let isReplayRecording = !!replay?.getReplayId()

        for (const exp of activeExperiments) {
            if (
                !cookies ||
                !Object.prototype.hasOwnProperty.call(cookies, exp.id)
            ) {
                const assignedArm = assignToArm(exp)
                for (const path of exp.paths) {
                    originalResponse.headers.append(
                        "Set-Cookie",
                        `${exp.id}=${assignedArm.id}; expires=${exp.expires.toUTCString()}; path=${path}`
                    )
                    cookies[exp.id] = assignedArm.id
                }
            }
        }

        // if user has accepted cookies and replay is not already recording, record
        // this session replay with probability 0 < p < 1 = max replaysSessionSampleRate
        // of all assigned arms.
        if (analyticsConsent && replay && !isReplayRecording) {
            const assignedArms = activeExperiments
                .filter((exp) =>
                    Object.prototype.hasOwnProperty.call(cookies, exp.id)
                )
                .map((exp) => exp.getArmById(cookies[exp.id]))
            const maxReplaySampleRate = Math.max(
                ...assignedArms.map((a) => a.replaysSessionSampleRate || 0)
            )
            if (maxReplaySampleRate) {
                const p = Math.random()
                if (p < maxReplaySampleRate) {
                    replay.start()
                }
            }
        }

        return originalResponse
    }

    return originalResponse
}

// assign visitor to an experimental arm
function assignToArm(experiment: Experiment): Arm {
    const p = Math.random()
    let assignedArm = experiment.arms[0] // default to first arm
    let cumulFraction = 0
    for (const arm of experiment.arms) {
        const assignToArm =
            p >= cumulFraction && p < cumulFraction + arm.fraction
        if (assignToArm) {
            assignedArm = arm
            break
        }
        cumulFraction += arm.fraction
    }
    return assignedArm
}
