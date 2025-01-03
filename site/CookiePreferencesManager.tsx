import { useEffect, useMemo, useReducer } from "react"
import Cookies from "js-cookie"
import { CookiePreferences } from "../site/blocks/CookiePreferences.js"
import { CookieNotice } from "../site/CookieNotice.js"
import {
    Action,
    arePreferencesOutdated,
    COOKIE_PREFERENCES_COOKIE_NAME,
    defaultState,
    getPreferenceValue,
    POLICY_DATE,
    PreferenceType,
    serializeState,
    State,
    updatePreference,
} from "./cookiePreferences.js"
import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

export const CookiePreferencesManager = ({
    initialState,
}: {
    initialState: State
}) => {
    const [state, dispatch] = useReducer(reducer, initialState)

    // Reset state
    useEffect(() => {
        if (arePreferencesOutdated(state.date, POLICY_DATE)) {
            dispatch({ type: Action.Reset })
        }
    }, [state.date])

    // Commit state
    useEffect(() => {
        if (state.date) {
            Cookies.set(COOKIE_PREFERENCES_COOKIE_NAME, serializeState(state), {
                expires: 365 * 3,
            })
        }
    }, [state])

    // Set GA consent
    const analyticsConsent = useMemo(
        () =>
            getPreferenceValue(PreferenceType.Analytics, state.preferences)
                ? "granted"
                : "denied",
        [state.preferences]
    )
    useEffect(() => {
        analytics.updateGAConsentSettings({
            analytics_storage: analyticsConsent,
        })
    }, [analyticsConsent])

    return (
        <div data-test-policy-date={POLICY_DATE} className="cookie-manager">
            <CookieNotice
                accepted={!!state.date}
                outdated={arePreferencesOutdated(state.date, POLICY_DATE)}
                dispatch={dispatch}
            />
            <CookiePreferences
                preferences={state.preferences}
                date={state.date?.toString()}
                dispatch={dispatch}
            />
        </div>
    )
}

const reducer = (
    state: State,
    { type: actionType, payload }: { type: Action; payload?: any }
): State => {
    switch (actionType) {
        case Action.Accept: {
            return {
                date: payload.date,
                preferences: updatePreference(
                    PreferenceType.Analytics,
                    true,
                    state.preferences
                ),
            }
        }
        case Action.TogglePreference:
            return {
                date: payload.date,
                preferences: updatePreference(
                    payload.preferenceType,
                    !getPreferenceValue(
                        payload.preferenceType,
                        state.preferences
                    ),
                    state.preferences
                ),
            }
        case Action.Reset:
            return defaultState
        case Action.Persist:
            return {
                ...state,
                date: payload.date,
            }
        case Action.Reject:
            return {
                date: payload.date,
                preferences: updatePreference(
                    PreferenceType.Analytics,
                    false,
                    state.preferences
                ),
            }
        default:
            return state
    }
}
