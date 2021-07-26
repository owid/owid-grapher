import ReactDOM from "react-dom"
import * as React from "react"
import { useEffect, useReducer } from "react"
import * as Cookies from "js-cookie"
import { CookiePreferences } from "../site/blocks/CookiePreferences"
import { CookieNotice } from "../site/CookieNotice"

export enum PreferenceType {
    Analytics = "a",
    Marketing = "m", // not used
}

export enum Action {
    Accept,
    TogglePreference,
    Reset,
}

export interface Preference {
    type: PreferenceType
    value: boolean
}

export const POLICY_ID: number = 20210726 // Update this when we change the policy
const COOKIE_NAME = "cookie_preferences"
const PREFERENCES_SEPARATOR = "|"
const POLICY_ID_SEPARATOR = "-"
const PREFERENCE_KEY_VALUE_SEPARATOR = ":"
// e.g. p:1-20200910

interface CookiePreferencesState {
    policyId?: number
    preferences: Preference[]
}

export interface CookiePreferencesDispatch {
    type: Action
    payload?: { preferenceType: PreferenceType; policyId: number }
}

const defaultState: CookiePreferencesState = {
    preferences: [
        {
            type: PreferenceType.Analytics,
            value: true,
        },
    ],
}

export const CookiePreferencesManager = ({
    initialState = defaultState,
}: {
    initialState: CookiePreferencesState
}) => {
    const [state, dispatch] = useReducer(reducer, initialState)

    // Reset state
    useEffect(() => {
        if (isPolicyOutdated(state.policyId, POLICY_ID)) {
            dispatch({ type: Action.Reset })
        }
    }, [state.policyId])

    // Commit state
    useEffect(() => {
        if (state.policyId) {
            Cookies.set(COOKIE_NAME, serializeState(state), {
                expires: 365 * 3,
            })
        }
    }, [state])

    const showControl = isPolicyOutdated(state.policyId, POLICY_ID)

    return (
        <div data-test-policy-date={POLICY_ID} className="cookie-manager">
            <CookieNotice show={showControl} dispatch={dispatch} />
            <CookiePreferences
                preferences={state.preferences}
                acceptedPolicyId={state.policyId}
                currentPolicyId={POLICY_ID}
                dispatch={dispatch}
            />
        </div>
    )
}

const reducer = (
    state: CookiePreferencesState,
    { type: actionType, payload }: CookiePreferencesDispatch
): CookiePreferencesState => {
    switch (actionType) {
        case Action.Accept: {
            return {
                policyId: payload.policyId,
                preferences: updatePreference(
                    PreferenceType.Analytics,
                    true,
                    state.preferences
                ),
            }
        }
        case Action.TogglePreference:
            return {
                policyId: payload.policyId,
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
        default:
            return state
    }
}

const getInitialState = (): CookiePreferencesState => {
    return parseRawCookieValue(Cookies.get(COOKIE_NAME)) ?? defaultState
}

export const parseRawCookieValue = (
    cookieValue?: string
): CookiePreferencesState | undefined => {
    if (!cookieValue) return

    const [preferencesRaw, dateRaw] = cookieValue.split(POLICY_ID_SEPARATOR)
    const date = parseId(dateRaw)
    if (!date) return

    const preferences = parsePreferences(preferencesRaw)
    if (!preferences.length) return

    return {
        preferences,
        policyId,
    }
}

export const parsePreferences = (preferences?: string): Preference[] => {
    if (!preferences) return []

    return preferences
        .split(PREFERENCES_SEPARATOR)
        .map((preference) => {
            const [type, , value] = preference // only supports 1 digit values
            return {
                type: type as PreferenceType,
                value: value === "1",
            }
        })
        .filter((preference) => isValidPreference(preference))
}

export const isValidPreference = ({ type, value }: Preference) => {
    return (
        Object.values(PreferenceType).includes(type as PreferenceType) &&
        typeof value === "boolean"
    )
}

export const parseId = (id?: string): number | undefined => {
    if (!id) return
    return parseInt(id, 10)
}

export const getPreferenceValue = (
    type: PreferenceType,
    preferences: Preference[]
) => {
    return (
        preferences.find((preference) => {
            return preference.type === type
        })?.value ?? false
    )
}

export const updatePreference = (
    type: PreferenceType,
    value: boolean,
    preferences: Preference[]
) => {
    return preferences.map((preference) => {
        if (preference.type !== type) return preference

        return {
            ...preference,
            value,
        }
    })
}

export const isPolicyOutdated = (
    preferencesPolicyId: number | undefined,
    currentPolicyId: number
) => {
    return preferencesPolicyId !== currentPolicyId
}

export const serializeState = (state: CookiePreferencesState) => {
    const serializedPreferences = state.preferences
        .map((preference) => {
            return `${preference.type}${PREFERENCE_KEY_VALUE_SEPARATOR}${
                preference.value ? 1 : 0
            }`
        })
        .join(PREFERENCES_SEPARATOR)

    return `${serializedPreferences}${POLICY_ID_SEPARATOR}${state.policyId}`
}

export const runCookiePreferencesManager = () => {
    const div = document.createElement("div")
    document.body.appendChild(div)

    ReactDOM.render(
        <CookiePreferencesManager initialState={getInitialState()} />,
        div
    )
}
