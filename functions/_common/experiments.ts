import {
    experiments,
    ExperimentArm,
    Experiment,
    validateUniqueExperimentIds,
} from "@ourworldindata/utils"
import * as cookie from "cookie"
import { SerializeOptions } from "cookie"

export interface ServerCookie {
    name: string
    value: string
    options?: SerializeOptions
}

export const experimentsMiddleware = (context) => {
    if (shouldSkipExperiments(context.request.url)) {
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
                    cookiesToSet.push({
                        name: exp.id,
                        value: assignedArm.id,
                        options: {
                            expires: exp.expires,
                            path: "/",
                        },
                    })
                    cookies[exp.id] = assignedArm.id
                }
            }
        }

        if (cookiesToSet.length) {
            context.data.cookiesToSet = cookiesToSet
        }
    }

    return context.next()
}

/**
 * Assigns a visitor to an experimental arm based on a random draw.
 *
 * @param experiment - The experiment to assign the visitor to.
 * @returns The assigned experimental arm.
 */
function assignToArm(experiment: Experiment): ExperimentArm {
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

/**
 * Checks if a given URL points to a static asset file.
 *
 * This function parses the provided URL and checks if its pathname ends with a common static asset file extension,
 * such as JavaScript, CSS, image, font, JSON, icon, or source map files.
 *
 * @param url - The URL string to check.
 * @returns `true` if the URL points to a static asset, `false` otherwise.
 *
 * @example
 * shouldSkipExperiments("https://example.com/styles/main.css") // true
 * shouldSkipExperiments("https://example.com/data") // false
 */
function shouldSkipExperiments(url: string): boolean {
    const pathname = new URL(url).pathname
    if (
        /\.(js|css|svg|png|jpg|jpeg|gif|woff2?|ttf|eot|otf|json|csv|ico|map)$/.test(
            pathname
        )
    ) {
        return true
    }
    return false
}
