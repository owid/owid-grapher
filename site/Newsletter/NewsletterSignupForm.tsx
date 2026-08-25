import { useState } from "react"
import * as React from "react"
import cx from "clsx"
import { Button, Checkbox, TextInput } from "@ourworldindata/components"
import { EmailNotificationsSubscribeRequest } from "@ourworldindata/types"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"
import {
    apiPost,
    getErrorMessage,
    throwIfApiError,
} from "./emailNotificationsApi.js"
import { storeSubscribePrefill } from "./subscribePrefill.js"

const analytics = new SiteAnalytics()

const NewsletterOption = ({
    id,
    title,
    cadence,
    description,
    checked,
    onChange,
}: {
    id: string
    title: string
    cadence: string
    description: string
    checked: boolean
    onChange: () => void
}) => (
    <Checkbox
        id={id}
        className="newsletter-signup-form__option"
        checked={checked}
        onChange={onChange}
        label={
            <>
                <span className="newsletter-signup-form__option-title">
                    {title}
                </span>{" "}
                <span className="newsletter-signup-form__option-cadence note-12-medium">
                    {cadence}
                </span>
                <span className="newsletter-signup-form__option-description">
                    {description}
                </span>
            </>
        }
    />
)

/**
 * The compact signup form shown in the header, the floating button, the
 * homepage and /latest once email notifications are enabled.
 *
 * The OWID Brief alone subscribes in place through our API (which adds the
 * address to Mailchimp). "Follow Topics" needs the topic and cadence controls
 * that only /subscribe has, so it hands the email and Brief choice over to
 * that page instead of subscribing here.
 */
export const NewsletterSignupForm = ({
    context,
    className,
}: {
    context: NewsletterSubscriptionContext
    className?: string
}) => {
    const [subscribeToOwidBrief, setSubscribeToOwidBrief] = useState(true)
    const [followTopics, setFollowTopics] = useState(false)
    const [email, setEmail] = useState("")
    const [isSubscribing, setIsSubscribing] = useState(false)
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const isSubmittable = subscribeToOwidBrief || followTopics

    const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        const trimmedEmail = email.trim()
        analytics.logSiteFormSubmit(
            "newsletter-subscribe",
            `Subscribe [${context}]`
        )

        if (followTopics) {
            storeSubscribePrefill({ email: trimmedEmail, subscribeToOwidBrief })
            window.location.assign("/subscribe")
            return
        }

        setError(null)
        setIsSubscribing(true)
        try {
            const request: EmailNotificationsSubscribeRequest = {
                email: trimmedEmail,
                subscribeToOwidBrief: true,
            }
            await throwIfApiError(await apiPost("/subscribe", request))
            setIsSubscribed(true)
        } catch (caught) {
            setError(getErrorMessage(caught))
        } finally {
            setIsSubscribing(false)
        }
    }

    if (isSubscribed)
        return (
            <p className={cx("newsletter-signup-form__success", className)}>
                To start receiving the OWID Brief, please confirm your
                subscription using the link in the email we have sent to{" "}
                <strong>{email.trim()}</strong>.
            </p>
        )

    return (
        <form
            className={cx("newsletter-signup-form", className)}
            onSubmit={handleSubmit}
        >
            <NewsletterOption
                id={`newsletter-signup-brief-${context}`}
                title="The OWID Brief"
                cadence="Twice a month"
                description="Stay up to date with our latest work plus curated highlights from across Our World in Data, twice a month."
                checked={subscribeToOwidBrief}
                onChange={() => setSubscribeToOwidBrief(!subscribeToOwidBrief)}
            />
            <NewsletterOption
                id={`newsletter-signup-topics-${context}`}
                title="Follow Topics"
                cadence={
                    followTopics
                        ? "Choose topics in next step"
                        : "Pick your cadence"
                }
                description="Receive updates on the topics you follow as we publish them, at your preferred frequency."
                checked={followTopics}
                onChange={() => setFollowTopics(!followTopics)}
            />
            {!isSubmittable && (
                <div className="newsletter-signup-form__alert">
                    Please select at least one option.
                </div>
            )}
            {error && (
                <div className="newsletter-signup-form__alert">{error}</div>
            )}
            <TextInput
                className="newsletter-signup-form__email sentry-mask"
                type="email"
                name="email"
                placeholder="Your email address"
                required={true}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />
            <Button
                className="newsletter-signup-form__submit"
                type="submit"
                theme="solid-vermillion"
                icon={null}
                disabled={!isSubmittable || isSubscribing}
                text={
                    followTopics
                        ? "See subscription options"
                        : isSubscribing
                          ? "Subscribing…"
                          : "Subscribe"
                }
            />
            <div className="newsletter-signup-form__privacy-notice">
                By subscribing you are agreeing to the terms of our{" "}
                <a href="/privacy-policy">privacy policy</a>.
            </div>
        </form>
    )
}
