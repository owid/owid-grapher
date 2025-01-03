import { useEffect, useState } from "react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCheck } from "@fortawesome/free-solid-svg-icons"
import { Action, getTodayDate } from "./cookiePreferences.js"

export const CookieNotice = ({
    accepted,
    outdated,
    dispatch,
}: {
    accepted: boolean
    outdated: boolean
    dispatch: any
}) => {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setTimeout(() => {
            setMounted(true)
        }, 200)
    }, [])

    return (
        <div
            className={classnames("cookie-notice", {
                open: mounted && (!accepted || outdated),
            })}
            data-test="cookie-notice"
        >
            <div className="cookie-notice__inner">
                <div>
                    <p className="cookie-notice__text">
                        We use cookies to give you the best experience on our
                        website.
                    </p>
                    <p className="cookie-notice__text">
                        By agreeing, you consent to our use of cookies and other
                        analytics tools according to{" "}
                        <a href="/privacy-policy">our privacy policy</a>.
                    </p>
                </div>
                <div className="actions">
                    <button
                        aria-label="Reject cookies"
                        className="button"
                        onClick={() =>
                            dispatch({
                                type: Action.Reject,
                                payload: { date: getTodayDate() },
                            })
                        }
                        data-test="reject"
                        data-track-note="cookie_notice"
                    >
                        No thanks
                    </button>
                    <button
                        aria-label="Accept cookies"
                        className="button accept"
                        onClick={() =>
                            dispatch({
                                type: Action.Accept,
                                payload: { date: getTodayDate() },
                            })
                        }
                        data-test="accept"
                        data-track-note="cookie_notice"
                    >
                        <span className="icon">
                            <FontAwesomeIcon icon={faCheck} />
                        </span>
                        I agree
                    </button>
                </div>
            </div>
        </div>
    )
}
