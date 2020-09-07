import * as React from "react"
import { useState } from "react"
import { faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons/faEnvelopeOpenText"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Analytics } from "grapher/core/Analytics"
import { ENV } from "settings"

const analytics = new Analytics(ENV)

export enum NewsletterSubscriptionContext {
    Homepage = "homepage",
    MobileMenu = "mobile-menu",
    Floating = "floating",
}

export const NewsletterSubscription = ({
    context,
}: {
    context?: NewsletterSubscriptionContext
}) => {
    const [isOpen, setIsOpen] = useState(false)

    const subscribeText = "Subscribe to receive updates"
    const closeText = "Close"

    return (
        <div className={`newsletter-subscription${isOpen ? " active" : ""}`}>
            {isOpen && (
                <>
                    <div
                        className="overlay"
                        onClick={() => {
                            setIsOpen(false)
                        }}
                    />
                    <div className="box">
                        <NewsletterSubscriptionForm context={context} />
                    </div>
                </>
            )}
            <button
                aria-label={isOpen ? closeText : subscribeText}
                className="prompt"
                data-track-note={
                    isOpen
                        ? "dialog-close-newsletter"
                        : "dialog-open-newsletter"
                }
                onClick={() => {
                    setIsOpen(!isOpen)
                }}
            >
                <FontAwesomeIcon icon={isOpen ? faTimes : faEnvelopeOpenText} />{" "}
                {isOpen ? closeText : subscribeText}
            </button>
        </div>
    )
}

export const NewsletterSubscriptionForm = ({
    context,
}: {
    context?: NewsletterSubscriptionContext
}) => {
    const IMMEDIATE = "1"
    const BIWEEKLY = "2"
    const idImmediate = `mce-group[85302]-85302-0${
        context ? "-" + context : ""
    }`
    const idBiweekly = `mce-group[85302]-85302-1${context ? "-" + context : ""}`

    const [frequencies, setFrequencies] = useState([IMMEDIATE])
    const isSubmittable = frequencies.length !== 0

    const updateFrequencies = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setFrequencies([e.target.value, ...frequencies])
        } else {
            setFrequencies(
                frequencies.filter((frequency) => frequency !== e.target.value)
            )
        }
    }

    return (
        <form
            action="https://ourworldindata.us8.list-manage.com/subscribe/post?u=18058af086319ba6afad752ec&id=2e166c1fc1"
            method="post"
            id="mc-embedded-subscribe-form"
            name="mc-embedded-subscribe-form"
            target="_blank"
        >
            <p>Receive our latest publications by email.</p>
            <fieldset>
                <div className="owid-checkboxes">
                    <div className="owid-checkbox-block">
                        <input
                            type="checkbox"
                            value={IMMEDIATE}
                            name={`group[85302][${IMMEDIATE}]`}
                            id={idImmediate}
                            checked={frequencies.includes(IMMEDIATE)}
                            onChange={updateFrequencies}
                        />
                        <label htmlFor={idImmediate}>
                            <div className="label-title">Immediate updates</div>
                            <div className="label-text">
                                Receive an email from us whenever we publish new
                                work (maximum 1 per day).
                            </div>
                        </label>
                    </div>
                    <div className="owid-checkbox-block">
                        <input
                            type="checkbox"
                            value={BIWEEKLY}
                            name={`group[85302][${BIWEEKLY}]`}
                            id={idBiweekly}
                            checked={frequencies.includes(BIWEEKLY)}
                            onChange={updateFrequencies}
                        />
                        <label htmlFor={idBiweekly}>
                            <div className="label-title">Biweekly digest</div>
                            <div className="label-text">
                                Receive an overview of our recent work every two
                                weeks.
                            </div>
                        </label>
                    </div>
                    {frequencies.length === 0 && (
                        <div className="alert">
                            Please select at least one option.
                        </div>
                    )}
                </div>
            </fieldset>
            <input
                placeholder="Your email address"
                type="email"
                className="owid-inline-input"
                name="EMAIL"
            />
            <div className="privacy-submit">
                <div className="privacy-notice">
                    By subscribing you are agreeing to <br />
                    the terms of our{" "}
                    <a href="/privacy-policy">privacy policy</a>.
                </div>
                <button
                    type="submit"
                    className="owid-inline-button"
                    disabled={!isSubmittable}
                    onClick={() =>
                        analytics.logSiteClick(
                            `Subscribe [${context ?? "other-contexts"}]`,
                            undefined,
                            "newsletter-subscribe"
                        )
                    }
                >
                    Subscribe
                </button>
            </div>
            <input
                type="hidden"
                name="b_18058af086319ba6afad752ec_2e166c1fc1"
                tabIndex={-1}
            />
        </form>
    )
}
