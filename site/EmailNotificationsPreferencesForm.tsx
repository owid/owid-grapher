import { useEffect, useState } from "react"
import * as React from "react"
import {
    EmailNotificationsBriefStatusResponse,
    EmailNotificationsFrequency,
    EmailNotificationsPreferencesResponse,
    EmailNotificationsRequestLinkRequest,
    EmailNotificationsSubscribeResponse,
    EmailNotificationsUpdatePreferencesRequest,
    LATEST_FEED_TYPE_VALUES,
    TagGraphRoot,
} from "@ourworldindata/types"
import { Checkbox, TextInput } from "@ourworldindata/components"
import { EMAIL_NOTIFICATIONS_API_BASE_URL } from "../settings/clientSettings.js"
import { EmailNotificationsPreferenceFields } from "./EmailNotificationsSubscribeForm.js"

type LatestFeedType = (typeof LATEST_FEED_TYPE_VALUES)[number]

/**
 * The magic-link preferences page. Its mode is driven by the token in the URL
 * fragment (kept out of server logs):
 * - no token: enter-email form that requests a magic link (the response is
 *   identical whether the email is subscribed or not)
 * - valid token: the preferences form, prefilled, saving immediately (the
 *   magic link was the proof of inbox control), with a fail-soft OWID Brief
 *   toggle that is only shown if Mailchimp answered
 * - expired token: offers to email a new link
 */
type Mode =
    | { name: "enter-email" }
    | { name: "loading" }
    | { name: "loaded"; email: string }
    | { name: "expired"; token: string }
    | { name: "invalid" }
    | { name: "link-sent" }
    | { name: "saved" }
    | { name: "unsubscribed" }

function getTokenFromLocation(): string | null {
    const match = window.location.hash.match(/token=([^&]+)/)
    return match ? match[1] : null
}

export const EmailNotificationsPreferencesForm = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const [mode, setMode] = useState<Mode>({ name: "loading" })
    const [token, setToken] = useState<string | null>(null)
    const [enteredEmail, setEnteredEmail] = useState("")
    const [contentTypes, setContentTypes] = useState<LatestFeedType[]>([
        ...LATEST_FEED_TYPE_VALUES,
    ])
    const [topicTags, setTopicTags] = useState<string[]>([])
    const [frequency, setFrequency] =
        useState<EmailNotificationsFrequency>("weekly")
    // null = toggle hidden (Mailchimp unavailable or not yet answered)
    const [subscribedToOwidBrief, setSubscribedToOwidBrief] = useState<
        boolean | null
    >(null)
    const [briefInitialStatus, setBriefInitialStatus] = useState<
        boolean | null
    >(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        const urlToken = getTokenFromLocation()
        setToken(urlToken)
        if (!urlToken) {
            setMode({ name: "enter-email" })
            return
        }
        const loadPreferences = async () => {
            try {
                const response = await fetch(
                    `${EMAIL_NOTIFICATIONS_API_BASE_URL}/preferences?token=${encodeURIComponent(urlToken)}`
                )
                const json: EmailNotificationsPreferencesResponse =
                    await response.json()
                if (response.status === 410) {
                    setMode({ name: "expired", token: urlToken })
                    return
                }
                if (!response.ok || !json.email) {
                    setMode({ name: "invalid" })
                    return
                }
                if (json.preferences) {
                    setTopicTags(json.preferences.topicTags)
                    setContentTypes([...json.preferences.contentTypes])
                    setFrequency(json.preferences.frequency)
                }
                setMode({ name: "loaded", email: json.email })
            } catch {
                setMode({ name: "invalid" })
            }
        }
        const loadBriefStatus = async () => {
            try {
                const response = await fetch(
                    `${EMAIL_NOTIFICATIONS_API_BASE_URL}/brief-status?token=${encodeURIComponent(urlToken)}`
                )
                if (!response.ok) return // fail soft: keep the toggle hidden
                const json: EmailNotificationsBriefStatusResponse =
                    await response.json()
                if (json.subscribedToOwidBrief !== undefined) {
                    setSubscribedToOwidBrief(json.subscribedToOwidBrief)
                    setBriefInitialStatus(json.subscribedToOwidBrief)
                }
            } catch {
                // fail soft
            }
        }
        void loadPreferences()
        void loadBriefStatus()
    }, [])

    const requestLink = async (
        request: EmailNotificationsRequestLinkRequest
    ) => {
        setErrorMessage(null)
        setIsSubmitting(true)
        try {
            const response = await fetch(
                `${EMAIL_NOTIFICATIONS_API_BASE_URL}/request-link`,
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
            setMode({ name: "link-sent" })
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

    const save = async (unsubscribe: boolean) => {
        if (!token) return
        setErrorMessage(null)
        const request: EmailNotificationsUpdatePreferencesRequest = unsubscribe
            ? { token, unsubscribe: true }
            : {
                  token,
                  preferences: { topicTags, contentTypes, frequency },
                  // Only include the Brief when the toggle was shown and the
                  // user actually changed it.
                  subscribeToOwidBrief:
                      subscribedToOwidBrief !== null &&
                      subscribedToOwidBrief !== briefInitialStatus
                          ? subscribedToOwidBrief
                          : undefined,
              }
        setIsSubmitting(true)
        try {
            const response = await fetch(
                `${EMAIL_NOTIFICATIONS_API_BASE_URL}/preferences`,
                {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(request),
                }
            )
            if (response.status === 410) {
                setMode({ name: "expired", token })
                return
            }
            const json: EmailNotificationsSubscribeResponse =
                await response.json()
            if (!response.ok || !json.ok) {
                throw new Error(
                    json.error ?? "Something went wrong. Please try again."
                )
            }
            setMode(unsubscribe ? { name: "unsubscribed" } : { name: "saved" })
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

    const errorAlert = errorMessage && (
        <div className="email-notifications-subscribe-form__alert">
            {errorMessage}
        </div>
    )

    switch (mode.name) {
        case "loading":
            return <p>Loading your preferences…</p>
        case "link-sent":
            return (
                <div className="email-notifications-subscribe-form__success">
                    <h3 className="h3-bold">Check your inbox</h3>
                    <p>
                        If that address is subscribed to email notifications, a
                        link to update its preferences is on its way. The link
                        is valid for 30 minutes.
                    </p>
                </div>
            )
        case "saved":
            return (
                <div className="email-notifications-subscribe-form__success">
                    <h3 className="h3-bold">Preferences updated</h3>
                    <p>
                        Your email notification preferences have been saved.
                        You'll receive an email when we publish new work
                        matching them.
                    </p>
                </div>
            )
        case "unsubscribed":
            return (
                <div className="email-notifications-subscribe-form__success">
                    <h3 className="h3-bold">You've been unsubscribed</h3>
                    <p>
                        You won't receive any more email notifications from us.
                        You can <a href="/subscribe">re-subscribe</a> at any
                        time.
                    </p>
                </div>
            )
        case "expired":
            return (
                <div className="email-notifications-preferences-form">
                    <h3 className="h3-bold">This link has expired</h3>
                    <p>
                        For your security, preference links are only valid for
                        30 minutes. We can email you a new one.
                    </p>
                    {errorAlert}
                    <button
                        type="button"
                        className="email-notifications-subscribe-form__submit"
                        disabled={isSubmitting}
                        onClick={() => requestLink({ token: mode.token })}
                    >
                        {isSubmitting ? "Sending…" : "Email me a new link"}
                    </button>
                </div>
            )
        case "invalid":
            return (
                <div className="email-notifications-preferences-form">
                    <h3 className="h3-bold">This link is not valid</h3>
                    <p>
                        Please use the link from our most recent email, or{" "}
                        <a href="/subscribe/preferences">request a new one</a>.
                    </p>
                </div>
            )
        case "enter-email":
            return (
                <form
                    className="email-notifications-preferences-form"
                    onSubmit={(event: React.SubmitEvent<HTMLFormElement>) => {
                        event.preventDefault()
                        if (enteredEmail.trim())
                            void requestLink({ email: enteredEmail.trim() })
                    }}
                >
                    <p>
                        Enter your email address and we'll send you a link to
                        view and update your notification preferences.
                    </p>
                    {errorAlert}
                    <div className="email-notifications-subscribe-form__email-submit">
                        <TextInput
                            placeholder="Your email address"
                            type="email"
                            className="email-notifications-subscribe-form__email sentry-mask"
                            name="email"
                            value={enteredEmail}
                            onChange={(event) =>
                                setEnteredEmail(event.target.value)
                            }
                            required={true}
                        />
                        <button
                            type="submit"
                            className="email-notifications-subscribe-form__submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Sending…" : "Email me a link"}
                        </button>
                    </div>
                </form>
            )
        case "loaded":
            return (
                <form
                    className="email-notifications-preferences-form"
                    onSubmit={(event: React.SubmitEvent<HTMLFormElement>) => {
                        event.preventDefault()
                        void save(false)
                    }}
                >
                    <p>
                        Updating the email notification preferences for{" "}
                        <strong>{mode.email}</strong>.
                    </p>
                    <EmailNotificationsPreferenceFields
                        topicTagGraph={topicTagGraph}
                        topicTags={topicTags}
                        contentTypes={contentTypes}
                        frequency={frequency}
                        onToggleTopicTag={(tagName) =>
                            setTopicTags((current) =>
                                current.includes(tagName)
                                    ? current.filter((name) => name !== tagName)
                                    : [...current, tagName]
                            )
                        }
                        onToggleContentType={(contentType) =>
                            setContentTypes((current) =>
                                current.includes(contentType)
                                    ? current.filter(
                                          (type) => type !== contentType
                                      )
                                    : [...current, contentType]
                            )
                        }
                        onSetFrequency={setFrequency}
                    />
                    {subscribedToOwidBrief !== null && (
                        <fieldset className="email-notifications-subscribe-form__fieldset">
                            <legend className="h5-black-caps">
                                Newsletter
                            </legend>
                            <Checkbox
                                id="email-notifications-preferences-owid-brief"
                                label="The OWID Brief — stay up to date with our latest work plus curated highlights from across Our World in Data, twice a month."
                                checked={subscribedToOwidBrief}
                                onChange={() =>
                                    setSubscribedToOwidBrief(
                                        !subscribedToOwidBrief
                                    )
                                }
                            />
                        </fieldset>
                    )}
                    {errorAlert}
                    <div className="email-notifications-preferences-form__actions">
                        <button
                            type="submit"
                            className="email-notifications-subscribe-form__submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Saving…" : "Save preferences"}
                        </button>
                        <button
                            type="button"
                            className="email-notifications-preferences-form__unsubscribe"
                            disabled={isSubmitting}
                            onClick={() => save(true)}
                        >
                            Unsubscribe from all email notifications
                        </button>
                    </div>
                </form>
            )
    }
}
