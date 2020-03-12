import * as React from "react"
import { useState } from "react"
import { faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons/faEnvelopeOpenText"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export const NewsletterSubscription = () => {
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
                        <NewsletterSubscriptionForm />
                    </div>
                </>
            )}
            <button
                aria-label={isOpen ? closeText : subscribeText}
                className="prompt"
                data-track-click
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
    context
}: {
    context?: string
}) => {
    const idImmediate = `${context ? context + "-" : ""}immediate`
    const idBiweekly = `${context ? context + "-" : ""}biweekly`

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
                            value="1"
                            name="group[85302][1]"
                            id={idImmediate}
                            defaultChecked
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
                            value="2"
                            name="group[85302][2]"
                            id={idBiweekly}
                        />
                        <label htmlFor={idBiweekly}>
                            <div className="label-title">Biweekly digest</div>
                            <div className="label-text">
                                Receive an overview of our recent work every two
                                weeks.
                            </div>
                        </label>
                    </div>
                </div>
            </fieldset>
            <div className="email-submit owid-inline-field">
                <input
                    placeholder="Your email address"
                    type="email"
                    className="owid-inline-input"
                    name="EMAIL"
                />
                <button type="submit" className="owid-inline-button">
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
