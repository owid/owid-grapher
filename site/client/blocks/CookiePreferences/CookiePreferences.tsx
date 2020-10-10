import * as React from "react"
import * as ReactDOM from "react-dom"
import {
    Action,
    getPreferenceValue,
    POLICY_DATE,
    Preference,
    PreferenceType,
} from "site/client/CookiePreferencesManager/CookiePreferencesManager"
import slugify from "slugify"

// Note: CookiePreferences has been designed to be rendered through a portal
// only. When this becomes limiting (e.g. cookies preferences rendered both in
// the content and in the cookie bar), then at least two things need to be taken
// care of:
// - unique IDs for input elements in CookiePreference
// - support for in-place rendering

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
    const id = `cookie-preference-${slugify(title, { lower: true })}`
    return (
        <div className="cookie-preference">
            <label htmlFor={id}>{title}</label>
            <input
                id={id}
                type="checkbox"
                onChange={toggleConsent}
                checked={consent}
                disabled={disabled}
            ></input>
            <div className="description">{children}</div>
        </div>
    )
}

export const CookiePreferences = ({
    preferences,
    dispatch,
}: {
    preferences: Preference[]
    dispatch: any
}) => {
    const cookiePreferencesDomSlot = document.querySelector(
        ".wp-block-cookie-preferences"
    )
    if (!cookiePreferencesDomSlot) return null

    return ReactDOM.createPortal(
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
                consent={getPreferenceValue(
                    PreferenceType.Performance,
                    preferences
                )}
                toggleConsent={() =>
                    dispatch({
                        type: Action.TogglePreference,
                        payload: {
                            preferenceType: PreferenceType.Performance,
                            date: POLICY_DATE,
                        },
                    })
                }
            >
                We use these cookies to monitor and improve website performance.
            </CookiePreference>
        </div>,
        cookiePreferencesDomSlot
    )
}
