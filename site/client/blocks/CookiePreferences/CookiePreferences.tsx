import moment from "moment"
import * as React from "react"
import * as ReactDOM from "react-dom"
import {
    Action,
    DATE_FORMAT,
    getPreferenceValue,
    getTodayDate,
    Preference,
    PreferenceType,
} from "site/client/CookiePreferencesManager/CookiePreferencesManager"
import slugify from "slugify"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCheck } from "@fortawesome/free-solid-svg-icons/faCheck"

// Note: CookiePreferences has been designed to be rendered through a portal
// only. When this becomes limiting (e.g. cookies preferences rendered both in
// the content and in the cookie bar), then at least two things need to be taken
// care of:
// - unique IDs for input elements in CookiePreference
// - support for in-place rendering

const CookiePreference = ({
    title,
    name,
    consent,
    disabled,
    toggleConsent,
    children,
}: {
    title: string
    name: string
    consent: boolean
    disabled?: boolean
    toggleConsent?: any
    children: React.ReactNode
}) => {
    const id = `cookie-preference-${slugify(name, { lower: true })}`
    return (
        <div className="cookie-preference">
            <input
                id={id}
                type="checkbox"
                onChange={toggleConsent}
                checked={consent}
                disabled={disabled}
                data-test={`${name}-preference`}
            ></input>
            <label htmlFor={id}>{title}</label>
            <div className="description">{children}</div>
        </div>
    )
}

export const CookiePreferences = ({
    preferences,
    date,
    dispatch,
}: {
    preferences: Preference[]
    date?: number
    dispatch: any
}) => {
    const cookiePreferencesDomSlot = document.querySelector(
        ".wp-block-cookie-preferences"
    )
    if (!cookiePreferencesDomSlot) return null

    return ReactDOM.createPortal(
        <div data-test="cookie-preferences" className="cookie-preferences">
            <CookiePreference
                title="Necessary cookies"
                name="necessary"
                consent={true}
                disabled={true}
            >
                The website cannot function properly without these cookies. If
                you wish, you can disable cookies completely in your browser
                preferences.
            </CookiePreference>
            <CookiePreference
                title="Analytics cookies"
                name="analytics"
                consent={getPreferenceValue(
                    PreferenceType.Analytics,
                    preferences
                )}
                toggleConsent={() =>
                    dispatch({
                        type: Action.TogglePreference,
                        payload: {
                            preferenceType: PreferenceType.Analytics,
                            date: getTodayDate(),
                        },
                    })
                }
            >
                We use these cookies to monitor and improve website performance.
            </CookiePreference>
            {date ? (
                <div className="last-updated">
                    Preferences last updated:{" "}
                    {moment(date, DATE_FORMAT).format("LL")}
                </div>
            ) : (
                <button
                    className="owid-button"
                    onClick={() =>
                        dispatch({
                            type: Action.Accept,
                            payload: { date: getTodayDate() },
                        })
                    }
                    data-test="accept"
                >
                    <span className="icon">
                        <FontAwesomeIcon icon={faCheck} />
                    </span>{" "}
                    I agree
                </button>
            )}
        </div>,
        cookiePreferencesDomSlot
    )
}
