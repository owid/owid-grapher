import { useState } from "react"
import * as React from "react"
import {
    EmailNotificationsSubscribeRequest,
    EmailNotificationsSubscribeResponse,
    TagGraphRoot,
} from "@ourworldindata/types"
import { TextInput } from "@ourworldindata/components"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { EmailNotificationsPreferenceFields } from "./EmailNotificationsPreferenceFields.js"
import { FollowTopicsOption, OwidBriefOption } from "./NewsletterOption.js"
import { apiPost, throwIfApiError } from "./emailNotificationsApi.js"
import { useApiSubmit } from "./useApiSubmit.js"
import { useNotificationPreferences } from "./useNotificationPreferences.js"

const analytics = new SiteAnalytics()

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
    const { isSubmitting, errorMessage, setErrorMessage, submit } =
        useApiSubmit()
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

        await submit(async () => {
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
        })
    }

    return (
        <form
            className="email-notifications-subscribe-form"
            onSubmit={onSubmit}
        >
            <OwidBriefOption
                id="email-notifications-owid-brief"
                checked={subscribeToOwidBrief}
                onChange={() => setSubscribeToOwidBrief(!subscribeToOwidBrief)}
            />
            <hr className="newsletter-form__divider" />
            <FollowTopicsOption
                id="email-notifications-follow-topics"
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
