import * as React from "react"
import { useEffect, useState } from "react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCheck } from "@fortawesome/free-solid-svg-icons/faCheck"
import {
    Action,
    POLICY_DATE,
} from "./CookiePreferencesManager/CookiePreferencesManager"

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
        >
            <div className="wrapper">
                <div className="owid-row">
                    <div className="owid-col owid-col--lg-1 explanation">
                        <p>
                            We use cookies to give you the best experience on
                            our website. By continuing without changing your
                            cookie settings, we assume you agree to this.
                        </p>
                    </div>
                    <div className="owid-col owid-col--lg-0 actions">
                        <a href="/privacy-policy" className="button">
                            Manage preferences
                        </a>
                        <button
                            className="button accept"
                            onClick={() =>
                                dispatch({
                                    type: Action.Accept,
                                    payload: { date: POLICY_DATE },
                                })
                            }
                        >
                            <span className="icon">
                                <FontAwesomeIcon icon={faCheck} />
                            </span>{" "}
                            I agree
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
