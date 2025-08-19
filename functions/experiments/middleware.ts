import { Experiment, validateUniqueExperimentIds } from "./Experiment.js"
import { Arm, ServerCookie } from "./types.js"
import { requestIsInIframe, isStaticAsset } from "./utils.js"
import { experiments } from "./config.js"
import * as cookie from "cookie"

export const experimentsMiddleware = (context) => {
    if (
        isStaticAsset(context.request.url) ||
        requestIsInIframe(context.request)
    ) {
        return context.next()
    }

    const cookies = cookie.parse(context.request.headers.get("cookie") || "")
    const cookiesToSet: ServerCookie[] = []

    const activeExperiments = experiments.filter((e) => !e.isExpired())
    if (activeExperiments && activeExperiments.length) {
        if (!validateUniqueExperimentIds(activeExperiments)) {
            throw new Error(`Experiment IDs are not unique`)
        }

        for (const exp of activeExperiments) {
            if (
                !cookies ||
                !Object.prototype.hasOwnProperty.call(cookies, exp.id)
            ) {
                // Check if the current request URL matches any of the experiment paths.
                // If so, then assign the same experimental arm to all paths in the experiment
                const requestPath = new URL(context.request.url).pathname
                const isOnExperimentPath = exp.isUrlInPaths(requestPath)

                if (isOnExperimentPath) {
                    const assignedArm = assignToArm(exp)
                    for (const path of exp.paths) {
                        const value = `arm:${assignedArm.id}&sentrySampleRate:${assignedArm.replaysSessionSampleRate}`
                        cookiesToSet.push({
                            name: exp.id,
                            value: value,
                            options: {
                                expires: exp.expires,
                                path: path,
                            },
                        })
                        cookies[exp.id] = value
                    }
                }
            }
        }

        if (cookiesToSet.length) {
            context.data.cookiesToSet = cookiesToSet
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
