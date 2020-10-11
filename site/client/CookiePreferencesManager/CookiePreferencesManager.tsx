import ReactDOM from "react-dom"
import * as React from "react"
import { useEffect, useReducer } from "react"
import * as Cookies from "js-cookie"

import { CookiePreferences } from "site/client/blocks/CookiePreferences/CookiePreferences"
import { CookieNotice } from "site/client/CookieNotice"
import moment from "moment"

export enum PreferenceType {
    Performance = "p",
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

export const POLICY_DATE: number = 20201009
export const DATE_FORMAT = "YYYYMMDD"
const COOKIE_NAME = "cookie_preferences"
const PREFERENCES_SEPARATOR = "|"
const DATE_SEPARATOR = "-"
const PREFERENCE_KEY_VALUE_SEPARATOR = ":"
// e.g. p:1-20200910

interface State {
    date?: number
    preferences: Preference[]
}

const defaultState: State = {
    preferences: [
        {
            type: PreferenceType.Performance,
            value: true,
        },
    ],
}

export const CookiePreferencesManager = ({
    initialState = defaultState,
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
            Cookies.set(COOKIE_NAME, serializeState(state), {
                expires: 365 * 3,
            })
        }
    }, [state])

    return (
        <div className="cookie-manager">
            <CookieNotice
                accepted={!!state.date}
                outdated={arePreferencesOutdated(state.date, POLICY_DATE)}
                dispatch={dispatch}
            />
            <CookiePreferences
                preferences={state.preferences}
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
                    PreferenceType.Performance,
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
        default:
            return state
    }
}

const getInitialState = (): State => {
    return parseRawCookieValue(Cookies.get(COOKIE_NAME)) ?? defaultState
}

export const parseRawCookieValue = (cookieValue?: string) => {
    if (!cookieValue) return

    const [preferencesRaw, dateRaw] = cookieValue.split(DATE_SEPARATOR)
    const date = parseDate(dateRaw)
    if (!date) return

    const preferences = parsePreferences(preferencesRaw)
    if (!preferences.length) return

    return {
        preferences,
        date,
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

export const parseDate = (date?: string): number | undefined => {
    if (!date) return

    return moment(date, DATE_FORMAT, true).isValid()
        ? parseInt(date, 10)
        : undefined
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

export const arePreferencesOutdated = (
    preferencesDate: number | undefined,
    policyDate: number
) => {
    if (!preferencesDate) return false
    return preferencesDate < policyDate
}

export const serializeState = (state: State) => {
    const serializedPreferences = state.preferences
        .map((preference) => {
            return `${preference.type}${PREFERENCE_KEY_VALUE_SEPARATOR}${
                preference.value ? 1 : 0
            }`
        })
        .join(PREFERENCES_SEPARATOR)

    return `${serializedPreferences}${DATE_SEPARATOR}${state.date}`
}

export const getTodayDate = () => {
    return moment().format(DATE_FORMAT)
}

export const runCookiePreferencesManager = () => {
    const div = document.createElement("div")
    document.body.appendChild(div)

    ReactDOM.render(
        <CookiePreferencesManager initialState={getInitialState()} />,
        div
    )
}
