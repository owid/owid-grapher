import { useState } from "react"
import * as React from "react"
import {
    EmailNotificationsSubscribeRequest,
    EmailNotificationsSubscribeResponse,
    TagGraphRoot,
} from "@ourworldindata/types"
import { Checkbox, TextInput } from "@ourworldindata/components"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { EmailNotificationsPreferenceFields } from "./EmailNotificationsPreferenceFields.js"
import {
    apiPost,
    getErrorMessage,
    throwIfApiError,
} from "./emailNotificationsApi.js"
import { useNotificationPreferences } from "./useNotificationPreferences.js"

const analytics = new SiteAnalytics()

const NewsletterOption = ({
    id,
    imageSrc,
    title,
    cadence,
    description,
    checked,
    onChange,
}: {
    id: string
    imageSrc: string
    title: string
    cadence: string
    description: string
    checked: boolean
    onChange: () => void
}) => (
    <div className="email-notifications-subscribe-form__newsletter">
        <img
            className="email-notifications-subscribe-form__newsletter-image"
            src={imageSrc}
            width={85}
            height={46}
            alt=""
        />
        <div className="email-notifications-subscribe-form__newsletter-content">
            <Checkbox
                id={id}
                checked={checked}
                onChange={onChange}
                label={
                    <>
                        <span className="email-notifications-subscribe-form__newsletter-title">
                            {title}
                        </span>{" "}
                        <span className="email-notifications-subscribe-form__newsletter-cadence">
                            {cadence}
                        </span>
                    </>
                }
            />
            <p className="email-notifications-subscribe-form__newsletter-description">
                {description}
            </p>
        </div>
    </div>
)

export const EmailNotificationsSubscribeForm = ({
    topicTagGraph,
    onSubscribed,
}: {
    topicTagGraph: TagGraphRoot
    onSubscribed: (email: string) => void
}) => {
    const [email, setEmail] = useState("")
    const [subscribeToOwidBrief, setSubscribeToOwidBrief] = useState(true)
    const [followTopics, setFollowTopics] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const preferences = useNotificationPreferences(topicTagGraph)

    const onSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        setErrorMessage(null)
        preferences.resetValidation()

        const trimmedEmail = email.trim()
        if (!trimmedEmail) {
            setErrorMessage("Please enter your email address.")
            return
        }
        if (!followTopics && !subscribeToOwidBrief) {
            setErrorMessage("Please select at least one newsletter.")
            return
        }
        if (followTopics && !preferences.validate()) return

        const request: EmailNotificationsSubscribeRequest = {
            email: trimmedEmail,
            notifications: followTopics ? preferences.forStorage() : undefined,
            subscribeToOwidBrief,
        }

        setIsSubmitting(true)
        try {
            const { response, json } =
                await apiPost<EmailNotificationsSubscribeResponse>(
                    "/subscribe",
                    request
                )
            throwIfApiError(response, json)
            analytics.logSiteFormSubmit(
                "newsletter-subscribe",
                "Subscribe [email-notifications]"
            )
            onSubscribed(trimmedEmail)
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form
            className="email-notifications-subscribe-form"
            onSubmit={onSubmit}
        >
            <NewsletterOption
                id="email-notifications-owid-brief"
                imageSrc="/images/biweekly-newsletter.webp"
                title="The OWID Brief"
                cadence="Twice a month"
                description="Stay up to date with our latest work plus curated highlights from across Our World in Data, twice a month."
                checked={subscribeToOwidBrief}
                onChange={() => setSubscribeToOwidBrief(!subscribeToOwidBrief)}
            />
            <hr className="email-notifications-subscribe-form__divider" />
            <NewsletterOption
                id="email-notifications-follow-topics"
                imageSrc="/images/data-insights.webp"
                title="Follow Topics"
                cadence="Pick your cadence"
                description="Receive updates on the topics you follow as we publish them."
                checked={followTopics}
                onChange={() => setFollowTopics(!followTopics)}
            />
            {followTopics && (
                <EmailNotificationsPreferenceFields
                    {...preferences.fieldsProps}
                />
            )}
            {errorMessage && (
                <div className="newsletter-form__alert">{errorMessage}</div>
            )}
            <div className="newsletter-form__email-submit">
                <TextInput
                    placeholder="Your email address"
                    type="email"
                    className="newsletter-form__email sentry-mask"
                    name="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required={true}
                />
                <button
                    type="submit"
                    aria-label="Subscribe to email notifications"
                    className="newsletter-form__submit"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Subscribing…" : "Subscribe"}
                </button>
            </div>
            <div className="email-notifications-subscribe-form__privacy-notice">
                By subscribing you are agreeing to the terms of our{" "}
                <a href="/privacy-policy">privacy policy</a>.
            </div>
        </form>
    )
}
