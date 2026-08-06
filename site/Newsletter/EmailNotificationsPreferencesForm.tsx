import { useEffect, useState } from "react"
import * as React from "react"
import cx from "clsx"
import { match } from "ts-pattern"
import {
    EmailNotificationsBriefStatusResponse,
    EmailNotificationsPreferencesResponse,
    EmailNotificationsRequestLinkRequest,
    EmailNotificationsSubscribeResponse,
    EmailNotificationsUpdatePreferencesRequest,
    TagGraphRoot,
} from "@ourworldindata/types"
import { TextInput } from "@ourworldindata/components"
import { EmailNotificationsPreferenceFields } from "./EmailNotificationsPreferenceFields.js"
import { FollowTopicsOption, OwidBriefOption } from "./NewsletterOption.js"
import { OwidSocials } from "../OwidSocials.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"
import { apiGet, apiPost, throwIfApiError } from "./emailNotificationsApi.js"
import { useApiSubmit } from "./useApiSubmit.js"
import { useNotificationPreferences } from "./useNotificationPreferences.js"
import {
    SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES,
    SubscribePageConfirmation,
    SubscribePageHero,
} from "./SubscribePageLayout.js"

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

/**
 * The screens the reader can act on, under the page heading. The terminal
 * screens (SubscribePageConfirmation) carry their own heading instead - which is
 * why this component renders the heading, rather than the page baking it.
 */
const PreferencesScreen = ({ children }: { children: React.ReactNode }) => (
    <>
        <SubscribePageHero heading="Update your preferences" />
        <div className={SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES}>{children}</div>
    </>
)

export const EmailNotificationsPreferencesForm = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const [mode, setMode] = useState<Mode>({ name: "loading" })
    const [token, setToken] = useState<string | null>(null)
    const [enteredEmail, setEnteredEmail] = useState("")
    // null = toggle hidden (Mailchimp unavailable or not yet answered)
    const [subscribedToOwidBrief, setSubscribedToOwidBrief] = useState<
        boolean | null
    >(null)
    const [briefInitialStatus, setBriefInitialStatus] = useState<
        boolean | null
    >(null)
    // Whether the reader keeps their topic subscription. Unchecking it and
    // saving unsubscribes from topic updates (but not the OWID Brief).
    const [followTopics, setFollowTopics] = useState(true)
    const { isSubmitting, errorMessage, setErrorMessage, submit } =
        useApiSubmit()
    const preferences = useNotificationPreferences(topicTagGraph)
    const { setFromStorage } = preferences

    useEffect(() => {
        const urlToken = getTokenFromLocation()
        setToken(urlToken)
        if (!urlToken) {
            setMode({ name: "enter-email" })
            return
        }
        const loadPreferences = async () => {
            try {
                const { response, json } =
                    await apiGet<EmailNotificationsPreferencesResponse>(
                        "/preferences",
                        { token: urlToken }
                    )
                if (response.status === 410) {
                    setMode({ name: "expired", token: urlToken })
                    return
                }
                if (!response.ok || !json.email) {
                    setMode({ name: "invalid" })
                    return
                }
                if (json.preferences) setFromStorage(json.preferences)
                setMode({ name: "loaded", email: json.email })
            } catch {
                setMode({ name: "invalid" })
            }
        }
        const loadBriefStatus = async () => {
            try {
                const { response, json } =
                    await apiGet<EmailNotificationsBriefStatusResponse>(
                        "/brief-status",
                        { token: urlToken }
                    )
                if (!response.ok) return // fail soft: keep the toggle hidden
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
    }, [topicTagGraph, setFromStorage])

    const requestLink = (request: EmailNotificationsRequestLinkRequest) =>
        submit(async () => {
            const { response, json } =
                await apiPost<EmailNotificationsSubscribeResponse>(
                    "/request-link",
                    request
                )
            throwIfApiError(response, json)
            setMode({ name: "link-sent" })
        })

    const save = async (unsubscribe: boolean) => {
        if (!token) return
        setErrorMessage(null)
        preferences.resetValidation()
        if (!unsubscribe && followTopics && !preferences.validate()) return
        if (!unsubscribe && !followTopics && !subscribedToOwidBrief) {
            setErrorMessage("Please select at least one newsletter.")
            return
        }

        // Only include the Brief when the toggle was shown and the user
        // actually changed it.
        const subscribeToOwidBrief =
            subscribedToOwidBrief !== null &&
            subscribedToOwidBrief !== briefInitialStatus
                ? subscribedToOwidBrief
                : undefined
        const request: EmailNotificationsUpdatePreferencesRequest = unsubscribe
            ? // "Unsubscribe from everything" also drops the OWID Brief.
              { token, unsubscribe: true, subscribeToOwidBrief: false }
            : followTopics
              ? {
                    token,
                    preferences: preferences.forStorage(),
                    subscribeToOwidBrief,
                }
              : // Follow Topics unchecked: stop topic updates, keep the Brief
                // subscription as chosen above.
                { token, unsubscribe: true, subscribeToOwidBrief }
        await submit(async () => {
            const { response, json } =
                await apiPost<EmailNotificationsSubscribeResponse>(
                    "/preferences",
                    request
                )
            if (response.status === 410) {
                setMode({ name: "expired", token })
                return
            }
            throwIfApiError(response, json)
            setMode(unsubscribe ? { name: "unsubscribed" } : { name: "saved" })
        })
    }

    const errorAlert = errorMessage && (
        <div className="newsletter-form__alert">{errorMessage}</div>
    )

    return match(mode)
        .with({ name: "loading" }, () => (
            <PreferencesScreen>
                <p>Loading your preferences…</p>
            </PreferencesScreen>
        ))
        .with({ name: "link-sent" }, () => (
            <PreferencesScreen>
                <div className="newsletter-form__success">
                    <h3 className="h3-bold">Check your inbox</h3>
                    <p>
                        If that address is subscribed to email notifications, a
                        link to update its preferences is on its way. The link
                        is valid for 30 minutes.
                    </p>
                </div>
            </PreferencesScreen>
        ))
        .with({ name: "saved" }, () => (
            <SubscribePageConfirmation heading="Preferences updated">
                {followTopics
                    ? "Your email notification preferences have been saved. You'll receive an email when we publish new work matching them."
                    : "Your preferences have been saved. You will no longer receive topic updates."}
            </SubscribePageConfirmation>
        ))
        .with({ name: "unsubscribed" }, () => (
            <SubscribePageConfirmation
                heading="You have been successfully unsubscribed"
                action={{ href: "/subscribe", label: "Resubscribe" }}
            >
                You will no longer receive emails from us. You can resubscribe
                any time.
            </SubscribePageConfirmation>
        ))
        .with({ name: "expired" }, ({ token: expiredToken }) => (
            <SubscribePageConfirmation
                variant="error"
                heading="This link has expired"
                action={{
                    label: isSubmitting ? "Sending…" : "Email me a new link",
                    onClick: () => void requestLink({ token: expiredToken }),
                    disabled: isSubmitting,
                }}
            >
                The link you followed is no longer valid. For your security,
                preference links are only valid for 30 minutes. We can email you
                a new one.
                {errorAlert}
            </SubscribePageConfirmation>
        ))
        .with({ name: "invalid" }, () => (
            <SubscribePageConfirmation
                variant="error"
                heading="This link is not valid"
                action={{
                    href: "/subscribe/preferences",
                    label: "Request a new link",
                }}
            >
                The link you followed is not valid. Please use the link from our
                most recent email, or request a new one.
            </SubscribePageConfirmation>
        ))
        .with({ name: "enter-email" }, () => (
            <PreferencesScreen>
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
                    <div className="newsletter-form__email-submit">
                        <TextInput
                            placeholder="Your email address"
                            type="email"
                            className="newsletter-form__email sentry-mask"
                            name="email"
                            value={enteredEmail}
                            onChange={(event) =>
                                setEnteredEmail(event.target.value)
                            }
                            required={true}
                        />
                        <button
                            type="submit"
                            className="newsletter-form__submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Sending…" : "Email me a link"}
                        </button>
                    </div>
                </form>
            </PreferencesScreen>
        ))
        .with({ name: "loaded" }, ({ email }) => (
            <>
                <SubscribePageHero heading="Update your preferences">
                    <div className="email-notifications-preferences-form__email-block">
                        <label
                            className="h6-black-caps"
                            htmlFor="email-notifications-preferences-email"
                        >
                            Email address
                        </label>
                        <TextInput
                            id="email-notifications-preferences-email"
                            className="newsletter-form__email sentry-mask"
                            type="email"
                            value={email}
                            disabled={true}
                        />
                        <p className="email-notifications-preferences-form__email-note">
                            These preferences apply to the email address above.
                        </p>
                    </div>
                </SubscribePageHero>
                <div
                    className={cx(
                        "subscribe-page__content",
                        SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES
                    )}
                >
                    <form
                        className="email-notifications-preferences-form"
                        onSubmit={(
                            event: React.SubmitEvent<HTMLFormElement>
                        ) => {
                            event.preventDefault()
                            void save(false)
                        }}
                    >
                        {subscribedToOwidBrief !== null && (
                            <>
                                <OwidBriefOption
                                    id="email-notifications-preferences-owid-brief"
                                    checked={subscribedToOwidBrief}
                                    onChange={() =>
                                        setSubscribedToOwidBrief(
                                            !subscribedToOwidBrief
                                        )
                                    }
                                    showExampleLink
                                />
                                <hr className="newsletter-form__divider" />
                            </>
                        )}
                        <FollowTopicsOption
                            id="email-notifications-preferences-follow-topics"
                            checked={followTopics}
                            onChange={() => setFollowTopics(!followTopics)}
                        />
                        {followTopics && (
                            <EmailNotificationsPreferenceFields
                                {...preferences.fieldsProps}
                            />
                        )}
                        {errorAlert}
                        <div className="email-notifications-preferences-form__actions">
                            <button
                                type="submit"
                                className="newsletter-form__submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting
                                    ? "Saving…"
                                    : "Update preferences"}
                            </button>
                            <p className="email-notifications-preferences-form__privacy-notice">
                                See our{" "}
                                <a href="/privacy-policy">privacy policy</a> for
                                more on how we handle your email.
                            </p>
                        </div>
                    </form>
                </div>
                <hr className="subscribe-page__divider span-cols-12 col-start-2" />
                <div className={SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES}>
                    <section className="email-notifications-unsubscribe">
                        <h2 className="email-notifications-unsubscribe__heading">
                            Done with our emails?
                        </h2>
                        <p className="email-notifications-unsubscribe__text">
                            You'll stop receiving the OWID Brief and all topic
                            updates. You can re-subscribe any time.
                        </p>
                        <button
                            type="button"
                            className="email-notifications-unsubscribe__button"
                            disabled={isSubmitting}
                            onClick={() => save(true)}
                        >
                            Unsubscribe from everything
                        </button>
                    </section>
                </div>
                <hr className="subscribe-page__divider span-cols-12 col-start-2" />
                <div
                    className={cx(
                        "subscribe-page__socials",
                        SUBSCRIBE_PAGE_CONTENT_GRID_CLASSES
                    )}
                >
                    <OwidSocials
                        includeRss
                        context={NewsletterSubscriptionContext.SubscribePage}
                    />
                </div>
            </>
        ))
        .exhaustive()
}
