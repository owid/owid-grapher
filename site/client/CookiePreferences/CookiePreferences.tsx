import Cookies from "js-cookie"
import * as React from "react"
import { useState } from "react"
import * as ReactDOM from "react-dom"

const COOKIE_PREFERENCES_COOKIE = "cookie_preferences"
const COOKIE_PREFERENCES_TYPES_SEPARATOR = "|"

export enum CookiePreferenceType {
    Performance = "p",
    Marketing = "m", // not used
}

const CookiePreference = ({
    title,
    consent,
    disabled,
    toggleConsent,
    children,
}: {
    title: string
    consent: boolean
    disabled?: boolean
    toggleConsent?: any
    children: React.ReactNode
}) => {
    return (
        <div className="cookie-preference">
            <div className="title">
                {title}
                <input
                    type="checkbox"
                    onChange={toggleConsent}
                    checked={consent}
                    disabled={disabled}
                ></input>
            </div>

            <div className="description">{children}</div>
        </div>
    )
}

export const CookiePreferences = () => {
    const [performance, setPerformance] = useState(
        getImplicitConsent(CookiePreferenceType.Performance)
    )

    const togglePerformance = () => {
        setPerformance(!performance)
        setCookiePreference(CookiePreferenceType.Performance, !performance)
    }

    return (
        <div className="cookie-preferences">
            <CookiePreference
                title="Necessary cookies"
                consent={true}
                disabled={true}
            >
                The website cannot function properly without these cookies. If
                you wish, you can disable cookies completely in your browser
                preferences.
            </CookiePreference>
            <CookiePreference
                title="Performance cookies"
                consent={performance}
                toggleConsent={togglePerformance}
            >
                We use these cookies to monitor and improve website performance.
            </CookiePreference>
        </div>
    )
}

export const getCookiePreference = (
    type: CookiePreferenceType,
    consents = ""
) => {
    const regex = new RegExp(`${type}:(\\d+)`)
    const match = regex.exec(consents)
    return match ? match[1] : undefined
}

const getImplicitConsent = (type: CookiePreferenceType) => {
    return getCookiePreference(type, readCookiePreferences()) !== "0"
}

export const setCookiePreference = (
    type: CookiePreferenceType,
    consent: boolean
) => {
    const updatedConsents = updateCookiePreference(
        type,
        consent ? 1 : 0,
        readCookiePreferences()
    )
    writeCookiePreferences(updatedConsents)
}

export const updateCookiePreference = (
    type: CookiePreferenceType,
    consent: number,
    consents = ""
) => {
    const otherConsents = consents
        .split(COOKIE_PREFERENCES_TYPES_SEPARATOR)
        .filter((consentStr) => {
            const [key, ,] = consentStr
            return key && key !== type
        })

    return [...otherConsents, `${type}:${consent}`].join(
        COOKIE_PREFERENCES_TYPES_SEPARATOR
    )
}

export const readCookiePreferences = () => {
    return Cookies.get(COOKIE_PREFERENCES_COOKIE)
}

export const writeCookiePreferences = (consents: string) => {
    Cookies.set(COOKIE_PREFERENCES_COOKIE, consents, { expires: 365 * 3 })
}

export const runCookiePreferences = () => {
    Array.from(
        document.querySelectorAll<HTMLDivElement>(
            ".wp-block-cookie-preferences"
        )
    ).forEach((div) => {
        ReactDOM.render(<CookiePreferences />, div)
    })
}
