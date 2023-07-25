import { dayjs, slugify } from "@ourworldindata/utils"
import React, { ReactPortal } from "react"
import ReactDOM from "react-dom"
import {
    Action,
    DATE_FORMAT,
    getPreferenceValue,
    getTodayDate,
    Preference,
    PreferenceType,
} from "../../site/CookiePreferencesManager.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCheck } from "@fortawesome/free-solid-svg-icons"
import { SiteAnalytics } from "../../site/SiteAnalytics.js"

const ANALYTICS_ACTION = "cookie_preferences"
const analytics = new SiteAnalytics()

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
    const id = `cookie-preference-${slugify(name)}`

    const onChange = () => {
        toggleConsent()
        analytics.logSiteClick(
            ANALYTICS_ACTION,
            `${consent ? "Refuse" : "Accept"} ${name}`
        )
    }

    return (
        <div className="cookie-preference">
            <input
                id={id}
                type="checkbox"
                onChange={onChange}
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
    date?: string
    dispatch: any
}): ReactPortal | null => {
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
                We use these cookies to monitor website usage and performance,
                helping us prioritize and demonstrate the reach of our work.{" "}
                <br />
                We are a non-profit and don't sell any of your data.
            </CookiePreference>
            {date ? (
                <div className="last-updated">
                    Preferences last updated:{" "}
                    {dayjs(date, DATE_FORMAT).format("MMMM D, YYYY")}
                </div>
            ) : (
                <button
                    className="owid-button"
                    onClick={() =>
                        dispatch({
                            type: Action.Persist,
                            payload: { date: getTodayDate() },
                        })
                    }
                    data-track-note={ANALYTICS_ACTION}
                >
                    <span className="icon">
                        <FontAwesomeIcon icon={faCheck} />
                    </span>
                    Save preferences
                </button>
            )}
        </div>,
        cookiePreferencesDomSlot
    )
}
