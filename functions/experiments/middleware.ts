import * as Sentry from "@sentry/react"
import { getAnalyticsConsentValue } from "../_common/cookieTools.js"
import { Experiment, validateUniqueExperimentIds } from "./Experiment.js"
import { Arm, ServerCookie } from "./types.js"
import { experiments } from "./config.js"
import * as cookie from "cookie"

export const experimentsMiddleware = (context) => {
    if (isStaticAsset(context.request.url) || isInIFrame()) {
        return context.next()
    }

    const cookies = cookie.parse(context.request.headers.get("cookie") || "")
    const cookiesToSet: ServerCookie[] = []

    const activeExperiments = experiments.filter((e) => !e.isExpired())
    if (activeExperiments && activeExperiments.length) {
        if (!validateUniqueExperimentIds(activeExperiments)) {
            throw new Error(`Experiment IDs are not unique`)
        }

        const analyticsConsent = getAnalyticsConsentValue(context.request)
        const replay = Sentry.getReplay()
        const isReplayRecording = !!replay?.getReplayId()

        for (const exp of activeExperiments) {
            if (
                !cookies ||
                !Object.prototype.hasOwnProperty.call(cookies, exp.id)
            ) {
                // Check if the current request URL matches any of the experiment paths.
                // If so, then assign the same experimental arm to all paths in the experiment
                const requestPath = new URL(context.request.url).pathname
                const matchingPath = exp.paths.find((path) =>
                    requestPath.startsWith(path)
                )

                if (matchingPath) {
                const assignedArm = assignToArm(exp)
                for (const path of exp.paths) {
                        cookiesToSet.push({
                            name: exp.id,
                            value: assignedArm.id,
                            options: {
                                expires: exp.expires,
                                path: path,
                            },
                        })
                    cookies[exp.id] = assignedArm.id
                    }
                }
            }
        }

        if (cookiesToSet.length) {
            context.data.cookiesToSet = cookiesToSet
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
    }

    return context.next()
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

function isStaticAsset(url: string): boolean {
    if (
        /\.(js|css|svg|png|jpg|jpeg|gif|woff2?|ttf|eot|otf|json|ico|map)$/.test(
            url
        )
    ) {
        return true
    }
    return false
}
