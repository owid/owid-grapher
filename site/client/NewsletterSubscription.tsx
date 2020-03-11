import * as React from "react"
import { useState } from "react"
import { faEnvelope } from "@fortawesome/free-solid-svg-icons/faEnvelope"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export const NewsletterSubscription = () => {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="newsletter-subscription">
            {isOpen && (
                <>
                    <div
                        className="overlay"
                        onClick={() => {
                            setIsOpen(false)
                        }}
                    />
                    <NewsletterSubscriptionForm />
                </>
            )}
            <button
                aria-label="Subscribe to our content updates"
                className="prompt"
                onClick={() => {
                    setIsOpen(!isOpen)
                }}
            >
                <FontAwesomeIcon icon={isOpen ? faTimes : faEnvelope} />
            </button>
        </div>
    )
}

export const NewsletterSubscriptionForm = ({
    context
}: {
    context?: string
}) => {
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
                            id={`${context ? context + "-" : ""}immediate`}
                            defaultChecked
                        />
                        <label
                            htmlFor={`${context ? context + "-" : ""}immediate`}
                        >
                            <div className="label-title">Immediate updates</div>
                            <div className="label-text">
                                Get emails whenever we produce new content.
                            </div>
                        </label>
                    </div>
                    <div className="owid-checkbox-block">
                        <input
                            type="checkbox"
                            value="2"
                            name="group[85302][2]"
                            id={`${context ? context + "-" : ""}bi-weekly`}
                        />
                        <label
                            htmlFor={`${context ? context + "-" : ""}bi-weekly`}
                        >
                            <div className="label-title">Weekly digest</div>
                            <div className="label-text">
                                Get bi-weekly emails with the biggest news.
                            </div>
                        </label>
                    </div>
                </div>
            </fieldset>
            <div className="owid-inline-field">
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
