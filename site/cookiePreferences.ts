import { dayjs } from "@ourworldindata/utils"
import Cookies from "js-cookie"

export enum PreferenceType {
    Analytics = "a",
    Marketing = "m", // not used
}

export enum Action {
    Accept,
    TogglePreference,
    Reset,
    Persist,
    Reject,
}

export interface Preference {
    type: PreferenceType
    value: boolean
}

export const POLICY_DATE: number = 20201009
export const DATE_FORMAT = "YYYYMMDD"
export const COOKIE_PREFERENCES_COOKIE_NAME = "cookie_preferences"
export const PREFERENCES_SEPARATOR = "|"
export const DATE_SEPARATOR = "-"
export const PREFERENCE_KEY_VALUE_SEPARATOR = ":"
// e.g. p:1-20200910

export interface State {
    date?: number
    preferences: Preference[]
}

export const defaultState: State = {
    preferences: [
        {
            type: PreferenceType.Analytics,
            value: false,
        },
    ],
}

export const getInitialState = (): State => {
    let cookieValue = undefined
    try {
        // Cookie access can be restricted by iframe sandboxing, in which case the below code will throw an error
        // see https://github.com/owid/owid-grapher/pull/2452

        cookieValue = parseRawCookieValue(
            Cookies.get(COOKIE_PREFERENCES_COOKIE_NAME)
        )
    } catch {
        // ignore
    }

    if (!cookieValue || arePreferencesOutdated(cookieValue.date, POLICY_DATE))
        return defaultState
    return cookieValue
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

    return dayjs(date, DATE_FORMAT, true).isValid()
        ? parseInt(date, 10)
        : undefined
}

export const getPreferenceValue = (
    type: PreferenceType,
    preferences: Preference[] = getInitialState().preferences
) => {
    return (
        preferences.find((preference) => {
            return preference.type === type
        })?.value ?? false
    )
}

// The rule doesn't support class components in the same file.

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

export const getTodayDate = () => dayjs().format(DATE_FORMAT)
