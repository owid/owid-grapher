import Cookies from "js-cookie"
import { EXPERIMENT_PREFIX } from "./constants.js"
import { Experiment } from "./Experiment.js"
import { experiments } from "./config.js"

export type ExperimentState = {
    assignedExperiments: Record<string, string>
    isPageInExperiment: boolean
}

export const defaultExperimentState: ExperimentState = {
    assignedExperiments: {},
    isPageInExperiment: false,
}

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
        activeExperiments.map((exp) => [exp.id, exp])
    )

    const assignedExperiments = getAssignedExperiments() ?? {}
    const currentPath =
        typeof window !== "undefined" ? window.location.pathname : ""

    return {
        assignedExperiments,
        isPageInExperiment: currentPath
            ? isPageInExperiment(
                  currentPath,
                  assignedExperiments,
                  activeExperimentMap
              )
            : false,
    }
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

    return filteredCookies
}

/**
 * Checks if the current page is in any assigned experiments.
 *
 * @param pathname - The page pathname
 * @param assignedExperiments - The assigned experiments mapping
 * @param experimentMap - Map of experiment ID to experiment instance
 * @returns true if the page is in an assigned experiment, false otherwise
 */
function isPageInExperiment(
    pathname: string,
    assignedExperiments: Record<string, string>,
    experimentMap: Map<string, Experiment>
): boolean {
    const experimentIds = Object.keys(assignedExperiments)
    if (experimentIds.length === 0) {
        return false
    }

    return experimentIds.some((expId: string) => {
        const experiment = experimentMap.get(expId)
        return experiment?.isUrlInPaths(pathname) ?? false
    })
}
