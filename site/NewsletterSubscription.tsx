import { useState } from "react"
import * as React from "react"
import cx from "clsx"
import { faTimes, faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { TextInput } from "@ourworldindata/components"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import { NewsletterIcon } from "./gdocs/components/NewsletterIcon.js"
import {
    MAILCHIMP_NEWSLETTER_GROUP_ID,
    MAILCHIMP_NEWSLETTER_SIGNUP_FORM_ACTION,
    MAILCHIMP_OWID_BRIEF_GROUP_VALUE,
    MAILCHIMP_SIGNUP_HONEYPOT_NAME,
    makeMailchimpNewsletterGroupInputName,
} from "./Newsletter/mailchimpSignup.js"

const analytics = new SiteAnalytics()

export const NewsletterSubscription = ({
    context,
}: {
    context:
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
                        <NewsletterSubscriptionHeader />
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

export const NewsletterSubscriptionHeader = ({
    showSubheading = false,
}: {
    showSubheading?: boolean
}) => {
    return (
        <div className="newsletter-subscription-header">
            <NewsletterIcon className="newsletter-subscription-header__icon" />
            <h4 className="newsletter-subscription-header__heading h3-bold">
                Subscribe to our newsletters
            </h4>
            {showSubheading && (
                <span className="newsletter-subscription-header__subheading">
                    Receive our latest work by email
                </span>
            )}
        </div>
    )
}

export const NewsletterSubscriptionForm = ({
    context,
    className = "",
}: {
    context: NewsletterSubscriptionContext
    className?: string
}) => {
    const DATA_INSIGHTS = "16"
    const BIWEEKLY = MAILCHIMP_OWID_BRIEF_GROUP_VALUE
    const idDataInsights = `mce-group[${MAILCHIMP_NEWSLETTER_GROUP_ID}]-${MAILCHIMP_NEWSLETTER_GROUP_ID}-0${context ? "-" + context : ""}`
    const idBiweekly = `mce-group[${MAILCHIMP_NEWSLETTER_GROUP_ID}]-${MAILCHIMP_NEWSLETTER_GROUP_ID}-1${context ? "-" + context : ""}`

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
            className={cx("newsletter-subscription-form", className)}
            action={MAILCHIMP_NEWSLETTER_SIGNUP_FORM_ACTION}
            method="post"
            id="mc-embedded-subscribe-banner"
            name="mc-embedded-subscribe-banner"
            onSubmit={() =>
                analytics.logSiteFormSubmit(
                    "newsletter-subscribe",
                    `Subscribe [${context ?? "other-contexts"}]`
                )
            }
        >
            <img
                alt=""
                className="newsletter-subscription-form__checkbox-image"
                src="/images/biweekly-newsletter.webp"
                width={1200}
                height={630}
            />
            <div className="newsletter-subscription-form__checkbox">
                <input
                    type="checkbox"
                    value={BIWEEKLY}
                    name={makeMailchimpNewsletterGroupInputName(BIWEEKLY)}
                    id={idBiweekly}
                    checked={frequencies.includes(BIWEEKLY)}
                    onChange={updateFrequencies}
                />
                <label htmlFor={idBiweekly}>
                    <span className="newsletter-subscription-form__label-title">
                        The OWID Brief
                    </span>{" "}
                    <span className="newsletter-subscription-form__label-frequency note-12-medium">
                        Twice a month
                    </span>
                    <div className="newsletter-subscription-form__label-text">
                        Stay up to date with our latest work plus curated
                        highlights from across Our World in Data, twice a month.
                    </div>
                </label>
                <a
                    className="newsletter-subscription-form__example-link note-12-medium"
                    href="https://mailchi.mp/ourworldindata/owid-brief-2025-11-14"
                >
                    See example OWID Brief newsletter
                </a>
            </div>
            <img
                alt=""
                className="newsletter-subscription-form__checkbox-image"
                src="/images/data-insights.webp"
                width={1200}
                height={630}
            />
            <div className="newsletter-subscription-form__checkbox">
                <input
                    type="checkbox"
                    value={DATA_INSIGHTS}
                    name={makeMailchimpNewsletterGroupInputName(DATA_INSIGHTS)}
                    id={idDataInsights}
                    checked={frequencies.includes(DATA_INSIGHTS)}
                    onChange={updateFrequencies}
                />
                <label htmlFor={idDataInsights}>
                    <span className="newsletter-subscription-form__label-title">
                        Data Insights
                    </span>{" "}
                    <span className="newsletter-subscription-form__label-frequency note-12-medium">
                        Every few days
                    </span>
                    <div className="newsletter-subscription-form__label-text">
                        Receive our bite-sized insights on how the world is
                        changing, every few days.
                    </div>
                </label>
                <a
                    className="newsletter-subscription-form__example-link note-12-medium"
                    href="https://us8.campaign-archive.com/?u=18058af086319ba6afad752ec&id=fdf16136e1"
                >
                    See example Data Insights newsletter
                </a>
            </div>
            {frequencies.length === 0 && (
                <div className="newsletter-subscription-form__alert">
                    Please select at least one option.
                </div>
            )}
            <div className="newsletter-subscription-form__email-submit">
                <TextInput
                    placeholder="Your email address"
                    type="email"
                    className="newsletter-subscription-form__email sentry-mask"
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
                    className="newsletter-subscription-form__submit"
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
                name={MAILCHIMP_SIGNUP_HONEYPOT_NAME}
                tabIndex={-1}
            />
            <div className="newsletter-subscription-form__privacy-notice">
                By subscribing you are agreeing to the terms of our{" "}
                <a href="/privacy-policy">privacy policy</a>.
            </div>
        </form>
    )
}
