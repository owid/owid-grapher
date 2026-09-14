import { getAll as getAllCookies } from "es-cookie"
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

    const currentPath = window.location.pathname
    const assignedExperiments = getAssignedArms(currentPath)

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
 * The experiment arms assigned to this visitor/page, keyed by experiment id.
 *
 * Two sources, because the two kinds of experiment remember their assignment
 * differently: visitor-assigned experiments store the arm in a cookie, while
 * page-assigned (cluster randomised) ones read it out of the config for the
 * given path — there is no cookie to find, because the arm belongs to the
 * page rather than the visitor.
 *
 * NB cookie-sourced arms are returned as-is: they are NOT filtered by path or
 * expiry (a visitor can carry an exp-* cookie from another page or a retired
 * experiment). Page-assigned arms are path-resolved and active-only. Callers
 * that need "applies on this path" semantics must check isUrlInPaths and
 * isExpired themselves, as SentryUtils does.
 *
 * Only works on the client, where cookies are available.
 */
export function getAssignedArms(pathname: string): Record<string, string> {
    const arms = getAssignedExperiments() ?? {}
    for (const exp of experiments) {
        if (exp.isExpired() || exp.unitOfAssignment !== "page") continue
        const arm = exp.getArmForUrl(pathname)
        if (arm) arms[exp.id] = arm
    }
    return arms
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

    const allCookies = getAllCookies()

    const filteredCookies = Object.fromEntries(
        Object.entries(allCookies).filter(([cookieName]) =>
            cookieName.startsWith(`${EXPERIMENT_PREFIX}-`)
        )
    )

    return filteredCookies
}
