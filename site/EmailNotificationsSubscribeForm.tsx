import { useState } from "react"
import * as React from "react"
import {
    EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS,
    EMAIL_NOTIFICATIONS_FREQUENCIES,
    EMAIL_NOTIFICATIONS_FREQUENCY_LABELS,
    EmailNotificationsFrequency,
    EmailNotificationsSubscribeRequest,
    EmailNotificationsSubscribeResponse,
    LATEST_FEED_TYPE_VALUES,
    TagGraphRoot,
} from "@ourworldindata/types"
import { Checkbox, TextInput } from "@ourworldindata/components"
import { EMAIL_NOTIFICATIONS_API_BASE_URL } from "../settings/clientSettings.js"
import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

type LatestFeedType = (typeof LATEST_FEED_TYPE_VALUES)[number]

export const EmailNotificationsSubscribeForm = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const [email, setEmail] = useState("")
    const [contentTypes, setContentTypes] = useState<LatestFeedType[]>([
        ...LATEST_FEED_TYPE_VALUES,
    ])
    const [topicTags, setTopicTags] = useState<string[]>([])
    const [frequency, setFrequency] =
        useState<EmailNotificationsFrequency>("weekly")
    const [subscribeToOwidBrief, setSubscribeToOwidBrief] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const toggleContentType = (contentType: LatestFeedType) => {
        setContentTypes((current) =>
            current.includes(contentType)
                ? current.filter((type) => type !== contentType)
                : [...current, contentType]
        )
    }

    const toggleTopicTag = (tagName: string) => {
        setTopicTags((current) =>
            current.includes(tagName)
                ? current.filter((name) => name !== tagName)
                : [...current, tagName]
        )
    }

    const wantsNotifications = contentTypes.length > 0

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setErrorMessage(null)

        const trimmedEmail = email.trim()
        if (!trimmedEmail) {
            setErrorMessage("Please enter your email address.")
            return
        }
        if (!wantsNotifications && !subscribeToOwidBrief) {
            setErrorMessage(
                "Please select at least one content type or the OWID Brief newsletter."
            )
            return
        }

        const request: EmailNotificationsSubscribeRequest = {
            email: trimmedEmail,
            notifications: wantsNotifications
                ? { topicTags, contentTypes, frequency }
                : undefined,
            subscribeToOwidBrief,
        }

        setIsSubmitting(true)
        try {
            const response = await fetch(
                `${EMAIL_NOTIFICATIONS_API_BASE_URL}/subscribe`,
                {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(request),
                }
            )
            const json: EmailNotificationsSubscribeResponse =
                await response.json()
            if (!response.ok || !json.ok) {
                throw new Error(
                    json.error ?? "Something went wrong. Please try again."
                )
            }
            analytics.logSiteFormSubmit(
                "newsletter-subscribe",
                "Subscribe [email-notifications]"
            )
            setIsSuccess(true)
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Something went wrong. Please try again."
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isSuccess) {
        return (
            <div className="email-notifications-subscribe-form__success">
                <h3 className="h3-bold">You're subscribed!</h3>
                <p>
                    Your email notification preferences have been saved. You'll
                    receive an email when we publish new work matching your
                    preferences.
                </p>
            </div>
        )
    }

    return (
        <form
            className="email-notifications-subscribe-form"
            onSubmit={onSubmit}
        >
            <fieldset className="email-notifications-subscribe-form__fieldset">
                <legend className="h5-black-caps">Newsletter</legend>
                <Checkbox
                    id="email-notifications-owid-brief"
                    label="The OWID Brief — stay up to date with our latest work plus curated highlights from across Our World in Data, twice a month."
                    checked={subscribeToOwidBrief}
                    onChange={() =>
                        setSubscribeToOwidBrief(!subscribeToOwidBrief)
                    }
                />
            </fieldset>
            <div className="email-notifications-subscribe-form__topic-notifications">
                <p>
                    Get an email when we publish new work on the topics you care
                    about, at the frequency of your choosing.
                </p>
                <fieldset className="email-notifications-subscribe-form__fieldset">
                    <legend className="h5-black-caps">Topics</legend>
                    <p className="email-notifications-subscribe-form__hint note-12-medium">
                        Leave all unchecked to receive updates on all topics.
                    </p>
                    {topicTagGraph.children.map((area) => (
                        <Checkbox
                            key={area.name}
                            id={`email-notifications-topic-${area.id}`}
                            label={area.name}
                            checked={topicTags.includes(area.name)}
                            onChange={() => toggleTopicTag(area.name)}
                        />
                    ))}
                </fieldset>
                <fieldset className="email-notifications-subscribe-form__fieldset">
                    <legend className="h5-black-caps">Content types</legend>
                    {LATEST_FEED_TYPE_VALUES.map((contentType) => (
                        <Checkbox
                            key={contentType}
                            id={`email-notifications-content-type-${contentType}`}
                            label={
                                EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS[
                                    contentType
                                ]
                            }
                            checked={contentTypes.includes(contentType)}
                            onChange={() => toggleContentType(contentType)}
                        />
                    ))}
                    {!wantsNotifications && (
                        <p className="email-notifications-subscribe-form__hint note-12-medium">
                            No content types selected: you won't receive email
                            notifications.
                        </p>
                    )}
                </fieldset>
                <fieldset className="email-notifications-subscribe-form__fieldset">
                    <legend className="h5-black-caps">Send me at most</legend>
                    {EMAIL_NOTIFICATIONS_FREQUENCIES.map((frequencyOption) => (
                        <div
                            key={frequencyOption}
                            className="email-notifications-subscribe-form__radio"
                        >
                            <input
                                type="radio"
                                id={`email-notifications-frequency-${frequencyOption}`}
                                name="email-notifications-frequency"
                                value={frequencyOption}
                                checked={frequency === frequencyOption}
                                onChange={() => setFrequency(frequencyOption)}
                            />
                            <label
                                htmlFor={`email-notifications-frequency-${frequencyOption}`}
                            >
                                {
                                    EMAIL_NOTIFICATIONS_FREQUENCY_LABELS[
                                        frequencyOption
                                    ]
                                }
                            </label>
                        </div>
                    ))}
                </fieldset>
            </div>
            {errorMessage && (
                <div className="email-notifications-subscribe-form__alert">
                    {errorMessage}
                </div>
            )}
            <div className="email-notifications-subscribe-form__email-submit">
                <TextInput
                    placeholder="Your email address"
                    type="email"
                    className="email-notifications-subscribe-form__email sentry-mask"
                    name="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required={true}
                />
                <button
                    type="submit"
                    aria-label="Subscribe to email notifications"
                    className="email-notifications-subscribe-form__submit"
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
