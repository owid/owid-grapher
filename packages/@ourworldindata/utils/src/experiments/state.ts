import Cookies from "js-cookie"
import { EXPERIMENT_PREFIX } from "./constants.js"
import { experiments } from "./config.js"

export type ExperimentState = Record<
    string,
    { arm: string; isPageInExperiment: boolean }
>

export const defaultExperimentState: ExperimentState = {}

/**
 * Gets the experiment state for the current page.
 *
 * This function should be called once when the module loads.
 *
 * @returns {ExperimentState} The experiment state for the current page.
 */
export function getExperimentState(): ExperimentState {
    if (typeof window === "undefined") {
        return defaultExperimentState
    }

    const activeExperiments = experiments.filter((exp) => !exp.isExpired())
    const activeExperimentMap = new Map(
        activeExperiments.map((exp) => [exp.id as string, exp])
    )

    const assignedExperiments = getAssignedExperiments() ?? {}
    const currentPath =
        typeof window !== "undefined" ? window.location.pathname : ""

    const state = {} as ExperimentState
    for (const [expId, armId] of Object.entries(assignedExperiments)) {
        const experiment = activeExperimentMap.get(expId)
        state[expId] = {
            arm: armId,
            isPageInExperiment: experiment?.isUrlInPaths(currentPath) ?? false,
        }
    }

    return state
}

/**
 * Gets the assigned experiments for the current user session.
 *
 * Only works on client, i.e. when cookies are available.
 *
 * @returns {Record<string, string> | undefined} A mapping of experiment IDs to their assigned arm IDs.
 *      Returns undefined if called on the server.
 */
function getAssignedExperiments(): Record<string, string> | undefined {
    if (typeof window === "undefined") return undefined

    const allCookies = Cookies.get()

    const filteredCookies = Object.fromEntries(
        Object.entries(allCookies).filter(([cookieName]) =>
            cookieName.startsWith(`${EXPERIMENT_PREFIX}-`)
        )
    )

    return filteredCookies as Record<string, string>
}
