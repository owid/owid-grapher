import { Survey } from "./Survey.js"
import { surveys } from "./config.js"

export type SurveyState = {
    activeSurveysOnPage: Survey[]
}

export const defaultSurveyState: SurveyState = {
    activeSurveysOnPage: [],
}

/**
 * Gets the survey state for the current page.
 *
 * This function should be called once when the module loads.
 *
 * @returns {SurveyState} The survey state for the current page.
 */
export function getSurveyState(): SurveyState {
    if (typeof window === "undefined") {
        return defaultSurveyState
    }

    const activeSurveysOnPage = getActiveSurveysOnPage() ?? []

    return {
        activeSurveysOnPage,
    }
}

/**
 * Gets the active surveys for the current page.
 *
 * Only works on client, i.e. when window is defined.
 *
 * @returns {Record<string, Survey> | undefined} A mapping of survey IDs to their corresponding Survey objects.
 *      Returns undefined if called on the server.
 */
function getActiveSurveysOnPage(): Survey[] | undefined {
    if (typeof window === "undefined") return undefined

    const currentPath =
        typeof window !== "undefined" ? window.location.pathname : ""

    const activeSurveys = surveys.filter(
        (s) => !s.isExpired() && s.isUrlInPaths(currentPath)
    )

    return activeSurveys
}
