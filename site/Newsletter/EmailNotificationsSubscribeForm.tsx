import { useState } from "react"
import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import {
    EmailNotificationsSubscribeRequest,
    EmailNotificationsSubscribeResponse,
} from "@ourworldindata/types"
import { Button, Checkbox, TextInput } from "@ourworldindata/components"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { EmailNotificationsPreferenceFields } from "./EmailNotificationsPreferenceFields.js"
import {
    apiPost,
    getErrorMessage,
    throwIfApiError,
} from "./emailNotificationsApi.js"
import { useNotificationPreferences } from "./useNotificationPreferences.js"
import { submitOwidBriefSignupToMailchimp } from "./mailchimpSignup.js"

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
                autoComplete="off"
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

export interface Subscription {
    email: string
}

export const EmailNotificationsSubscribeForm = ({
    topicAreaNames,
    onSubscribed,
}: {
    topicAreaNames: string[]
    onSubscribed: (subscription: Subscription) => void
}) => {
    const [email, setEmail] = useState("")
    const [subscribeToOwidBrief, setSubscribeToOwidBrief] = useState(true)
    const [followTopics, setFollowTopics] = useState(true)
    const [validationError, setValidationError] = useState<string | null>(null)
    const preferences = useNotificationPreferences(topicAreaNames)

    const subscribe = useMutation({
        mutationFn: async (request: EmailNotificationsSubscribeRequest) => {
            const response = await apiPost("/subscribe", request)
            await throwIfApiError(response)
            return (await response.json()) as EmailNotificationsSubscribeResponse
        },
        onSuccess: (response, request) => {
            analytics.logSiteFormSubmit(
                "newsletter-subscribe",
                "Subscribe [email-notifications]"
            )
            if (response.mailchimpSignupRequired) {
                submitOwidBriefSignupToMailchimp(request.email)
                return
            }
            onSubscribed({
                email: request.email,
            })
        },
    })

    const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        setValidationError(null)
        preferences.resetValidation()

        const trimmedEmail = email.trim()
        if (!trimmedEmail) {
            setValidationError("Please enter your email address.")
            return
        }
        if (!followTopics && !subscribeToOwidBrief) {
            setValidationError("Please select at least one newsletter.")
            return
        }
        if (followTopics && !preferences.validate()) return

        subscribe.mutate({
            email: trimmedEmail,
            notifications: followTopics ? preferences.forStorage() : undefined,
            subscribeToOwidBrief,
        })
    }

    const errorMessage =
        validationError ??
        (subscribe.error ? getErrorMessage(subscribe.error) : null)

    return (
        <form
            className="email-notifications-subscribe-form"
            onSubmit={handleSubmit}
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
                <div className="email-notifications-subscribe-form__topic-preferences">
                    <EmailNotificationsPreferenceFields
                        {...preferences.fieldsProps}
                    />
                </div>
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
                <Button
                    type="submit"
                    theme="solid-vermillion"
                    icon={null}
                    ariaLabel="Subscribe to email notifications"
                    text={subscribe.isPending ? "Subscribing…" : "Subscribe"}
                    disabled={subscribe.isPending}
                />
            </div>
            <div className="email-notifications-subscribe-form__privacy-notice">
                By subscribing you are agreeing to the terms of our{" "}
                <a href="/privacy-policy">privacy policy</a>.
            </div>
        </form>
    )
}
