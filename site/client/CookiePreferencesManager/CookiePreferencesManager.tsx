import ReactDOM from "react-dom"
import * as React from "react"
import { useState } from "react"
import * as Cookies from "js-cookie"

import { CookiePreferences } from "site/client/blocks/CookiePreferences/CookiePreferences"
import { CookieNotice } from "site/client/CookieNotice"

export enum CookiePreferenceType {
    Performance = "p",
    Date = "d",
}

const POLICY_DATE: number = 20201010
const COOKIE_NAME = "cookie_preferences"
const SEPARATOR = "|"

export const CookiePreferencesManager = () => {
    const [accepted, setAccepted] = useState(
        getPreference(CookiePreferenceType.Date, readPreferences()) ===
            POLICY_DATE
    )
    const [performance, setPerformance] = useState(
        getImplicitConsent(CookiePreferenceType.Performance)
    )

    const onTogglePerformance = () => {
        setAccepted(true)
        setPerformance(!performance)
        setPreference(CookiePreferenceType.Performance, performance ? 0 : 1)
    }

    const onAccept = () => {
        setAccepted(true)
        setPreference(CookiePreferenceType.Performance, performance ? 1 : 0)
    }

    return (
        <div className="cookie-manager">
            <CookieNotice accepted={accepted} onAccept={onAccept} />
            <CookiePreferences
                performance={performance}
                togglePerformance={onTogglePerformance}
            />
        </div>
    )
}

export const getPreference = (type: CookiePreferenceType, preferences = "") => {
    const regex = new RegExp(`${type}:(\\d+)`)
    const match = regex.exec(preferences)
    return match ? parseInt(match[1], 10) : undefined
}

const getImplicitConsent = (type: CookiePreferenceType) => {
    return getPreference(type, readPreferences()) !== 0
}

const setPreference = (type: CookiePreferenceType, preference: number) => {
    const currentPreferences = readPreferences()

    let updatedPreferences = updatePreference(
        type,
        preference,
        currentPreferences
    )

    // Concurrently append / update current policy date for every preference set
    updatedPreferences = updatePreference(
        CookiePreferenceType.Date,
        POLICY_DATE,
        updatedPreferences
    )

    writePreferences(updatedPreferences)
}

export const updatePreference = (
    type: CookiePreferenceType,
    preference: number,
    preferences = ""
) => {
    const otherPreferences = preferences
        .split(SEPARATOR)
        .filter((consentStr) => {
            const [key, ,] = consentStr
            return key && key !== type
        })

    return [...otherPreferences, `${type}:${preference}`].join(SEPARATOR)
}

export const readPreferences = () => {
    return Cookies.get(COOKIE_NAME)
}

const writePreferences = (consents: string) => {
    Cookies.set(COOKIE_NAME, consents, { expires: 365 * 3 })
}

export const runCookiePreferencesManager = () => {
    const div = document.createElement("div")
    document.body.appendChild(div)
    ReactDOM.render(<CookiePreferencesManager />, div)
}
