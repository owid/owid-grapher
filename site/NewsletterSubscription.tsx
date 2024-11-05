import React, { useState } from "react"
import { faTimes, faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { TextInput } from "@ourworldindata/components"
import { NewsletterSubscriptionContext } from "./newsletter.js"

const analytics = new SiteAnalytics()

export const NewsletterSubscription = ({
    context,
}: {
    context?:
        | NewsletterSubscriptionContext.Homepage
        | NewsletterSubscriptionContext.Floating
}) => {
    const [isOpen, setIsOpen] = useState(false)

    const subscribeText = "Subscribe"

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
            {isOpen ? (
                <button
                    aria-label="Close subscription form"
                    className="prompt"
                    onClick={() => setIsOpen(false)}
                >
                    <FontAwesomeIcon icon={faTimes} /> Close
                </button>
            ) : (
                <button
                    aria-label={subscribeText}
                    className="prompt"
                    data-track-note="dialog_open_newsletter"
                    onClick={() => {
                        setIsOpen(!isOpen)
                    }}
                >
                    <FontAwesomeIcon icon={faEnvelopeOpenText} />
                    {subscribeText}
                </button>
            )}
        </div>
    )
}

export const NewsletterSubscriptionForm = ({
    context,
}: {
    context?: NewsletterSubscriptionContext
}) => {
    const DATA_INSIGHTS = "16"
    const BIWEEKLY = "2"
    const idDataInsights = `mce-group[85302]-85302-0${
        context ? "-" + context : ""
    }`
    const idBiweekly = `mce-group[85302]-85302-1${context ? "-" + context : ""}`

    const [frequencies, setFrequencies] = useState([DATA_INSIGHTS, BIWEEKLY])
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
            onSubmit={() =>
                analytics.logSiteFormSubmit(
                    "newsletter-subscribe",
                    `Subscribe [${context ?? "other-contexts"}]`
                )
            }
        >
            <span className="NewsletterSubscriptionForm__header">
                Receive our latest work by email.
            </span>
            <div className="owid-checkbox-block">
                <input
                    type="checkbox"
                    value={DATA_INSIGHTS}
                    name={`group[85302][${DATA_INSIGHTS}]`}
                    id={idDataInsights}
                    checked={frequencies.includes(DATA_INSIGHTS)}
                    onChange={updateFrequencies}
                />
                <label htmlFor={idDataInsights}>
                    <div className="label-title">Daily Data Insights</div>
                    <div className="label-text">
                        Receive our bite-sized insights on how the world is
                        changing, every weekday.
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
                    <div className="label-title">Biweekly Digest</div>
                    <div className="label-text">
                        Receive an overview of our recent work and highlights of
                        our other work every two weeks.
                    </div>
                </label>
            </div>
            {frequencies.length === 0 && (
                <div className="alert">Please select at least one option.</div>
            )}
            <div className="NewsletterSubscription__email-submit">
                <TextInput
                    placeholder="Your email address"
                    type="email"
                    className="NewsletterSubscription__email sentry-mask"
                    name="EMAIL"
                    required={true}
                />
                <button
                    aria-label="Subscribe to newsletter"
                    disabled={!isSubmittable}
                    onClick={() =>
                        analytics.logSiteClick(
                            "newsletter-subscribe",
                            `Subscribe [${context ?? "other-contexts"}]`
                        )
                    }
                    className="NewsletterSubscription__submit"
                >
                    Subscribe
                </button>
            </div>
            {/* This hidden field should not be the last element in the form as long as we use the row-gap mixin
            to space elements vertically. When placed as the last element of the form, this hidden element becomes
            the target of the :last-child selector of the row-gap mixin, when it should be applied to the last visible
            element instead */}
            <input
                type="hidden"
                name="b_18058af086319ba6afad752ec_2e166c1fc1"
                tabIndex={-1}
            />
            <div className="NewsletterSubscription__privacy">
                By subscribing you are agreeing to the terms of our{" "}
                <a href="/privacy-policy">privacy policy</a>.
            </div>
        </form>
    )
}
