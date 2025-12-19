import classnames from "classnames"
import { useState } from "react"
import { useMediaQuery, useTimeout } from "usehooks-ts"
import { faCheck } from "@fortawesome/free-solid-svg-icons"
import { Button } from "@ourworldindata/components"
import { Action, getTodayDate } from "./cookiePreferences.js"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "./SiteConstants.js"

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
    useTimeout(() => setMounted(true), 200)
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)

    const actions = (
        <div className="cookie-notice__actions">
            <Button
                theme="outline-dark-blue"
                text="Reject optional cookies"
                icon={null}
                onClick={() =>
                    dispatch({
                        type: Action.Reject,
                        payload: { date: getTodayDate() },
                    })
                }
                className="cookie-notice__button"
                dataTrackNote="cookie_notice"
            />
            <Button
                theme="solid-dark-blue"
                text="Accept optional cookies"
                icon={faCheck}
                iconPosition="left"
                onClick={() =>
                    dispatch({
                        type: Action.Accept,
                        payload: { date: getTodayDate() },
                    })
                }
                className="cookie-notice__button"
                dataTrackNote="cookie_notice"
            />
        </div>
    )

    return (
        <div
            className={classnames("cookie-notice", {
                open: mounted && (!accepted || outdated),
            })}
        >
            <div className="cookie-notice__inner">
                {isSmallScreen ? (
                    <>
                        <p className="cookie-notice__text">
                            We use essential cookies to run the site; these
                            can’t be disabled. Other optional cookies help us
                            understand how our site is used and improve it for
                            everyone.
                        </p>
                        <p className="cookie-notice__text">
                            Read more in our{" "}
                            <a href="/privacy-policy">Privacy Policy</a> or{" "}
                            <a href="/cookie-notice#cookie-preferences">
                                manage preferences
                            </a>
                            .
                        </p>
                        {actions}
                    </>
                ) : (
                    <>
                        <div className="cookie-notice__header">
                            <div>
                                <h2 className="cookie-notice__title">
                                    Cookies help us build a better website
                                </h2>
                                <p className="cookie-notice__text">
                                    We are a <strong>non-profit</strong> that
                                    relies on reader{" "}
                                    <a href="/donate">donations</a>. We never
                                    use ads on our website or sell user data.
                                </p>
                            </div>
                            {actions}
                        </div>
                        <p className="cookie-notice__text">
                            We use a small number of <strong>cookies</strong>{" "}
                            and similar technologies to{" "}
                            <strong>make our website work</strong>. Some of
                            these are essential and can't be switched off. Other{" "}
                            <strong>optional cookies</strong> help us better
                            understand <strong>how our website is used</strong>{" "}
                            — by accepting these, you can help us improve our
                            publication for everyone. Read more in our{" "}
                            <a href="/privacy-policy">Privacy Policy</a> or{" "}
                            <a href="/cookie-notice#cookie-preferences">
                                manage your cookie settings
                            </a>
                            .
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}
