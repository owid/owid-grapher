import { useEffect, useState } from "react"
import * as React from "react"
import { match } from "ts-pattern"
import {
    EmailNotificationsBriefStatusResponse,
    EmailNotificationsPreferencesResponse,
    EmailNotificationsRequestLinkRequest,
    EmailNotificationsSubscribeResponse,
    EmailNotificationsUpdatePreferencesRequest,
    TagGraphRoot,
} from "@ourworldindata/types"
import { Checkbox, TextInput } from "@ourworldindata/components"
import { EmailNotificationsPreferenceFields } from "./EmailNotificationsPreferenceFields.js"
import {
    apiGet,
    apiPost,
    getErrorMessage,
    throwIfApiError,
} from "./emailNotificationsApi.js"
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
        <SubscribePageHero heading="Update your email preferences" />
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
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
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

    const requestLink = async (
        request: EmailNotificationsRequestLinkRequest
    ) => {
        setErrorMessage(null)
        setIsSubmitting(true)
        try {
            const { response, json } =
                await apiPost<EmailNotificationsSubscribeResponse>(
                    "/request-link",
                    request
                )
            throwIfApiError(response, json)
            setMode({ name: "link-sent" })
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        } finally {
            setIsSubmitting(false)
        }
    }

    const save = async (unsubscribe: boolean) => {
        if (!token) return
        setErrorMessage(null)
        preferences.resetValidation()
        if (!unsubscribe && !preferences.validate()) return

        const request: EmailNotificationsUpdatePreferencesRequest = unsubscribe
            ? { token, unsubscribe: true }
            : {
                  token,
                  preferences: preferences.forStorage(),
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
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        } finally {
            setIsSubmitting(false)
        }
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
                Your email notification preferences have been saved. You'll
                receive an email when we publish new work matching them.
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
            <PreferencesScreen>
                <form
                    className="email-notifications-preferences-form"
                    onSubmit={(event: React.SubmitEvent<HTMLFormElement>) => {
                        event.preventDefault()
                        void save(false)
                    }}
                >
                    <p>
                        Updating the email notification preferences for{" "}
                        <strong>{email}</strong>.
                    </p>
                    <EmailNotificationsPreferenceFields
                        {...preferences.fieldsProps}
                    />
                    {subscribedToOwidBrief !== null && (
                        <fieldset className="newsletter-form__fieldset">
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
                            className="newsletter-form__submit"
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
            </PreferencesScreen>
        ))
        .exhaustive()
}
