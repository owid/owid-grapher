import { useState } from "react"
import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { match } from "ts-pattern"
import {
    EmailNotificationsPreferences,
    EmailNotificationsPreferencesResponse,
    EmailNotificationsRequestLinkRequest,
    EmailNotificationsUpdatePreferencesRequest,
} from "@ourworldindata/types"
import { Button, Checkbox, TextInput } from "@ourworldindata/components"
import { SiteQueryClientProvider } from "../SiteQueryClientProvider.js"
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
 *   magic link was the proof of inbox control), with independent Follow
 *   Topics and Mailchimp-owned OWID Brief controls
 * - expired token: offers to email a new link
 */
export const EmailNotificationsPreferencesForm = ({
    topicAreaNames,
}: {
    topicAreaNames: string[]
}) => {
    const [token] = useState(
        () => window.location.hash.match(/token=([^&]+)/)?.[1] ?? null
    )

    return (
        <SiteQueryClientProvider>
            {token ? (
                <TokenScreen token={token} topicAreaNames={topicAreaNames} />
            ) : (
                <EnterEmailScreen />
            )}
        </SiteQueryClientProvider>
    )
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

const LinkSentScreen = () => (
    <PreferencesScreen>
        <div className="newsletter-form__success">
            <h3 className="h3-bold">Check your inbox</h3>
            <p>
                If that address is subscribed to email notifications, a link to
                update its preferences is on its way. The link is valid for 30
                minutes.
            </p>
        </div>
    </PreferencesScreen>
)

const ErrorAlert = ({ error }: { error: unknown }) =>
    error ? (
        <div className="newsletter-form__alert">{getErrorMessage(error)}</div>
    ) : null

function useRequestLinkMutation() {
    return useMutation({
        mutationFn: async (request: EmailNotificationsRequestLinkRequest) => {
            const response = await apiPost("/request-link", request)
            await throwIfApiError(response)
        },
    })
}

const EnterEmailScreen = () => {
    const [email, setEmail] = useState("")
    const requestLink = useRequestLinkMutation()

    if (requestLink.isSuccess) return <LinkSentScreen />

    const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        const trimmedEmail = email.trim()
        if (trimmedEmail) requestLink.mutate({ email: trimmedEmail })
    }

    return (
        <PreferencesScreen>
            <form
                className="email-notifications-preferences-form"
                onSubmit={handleSubmit}
            >
                <p>
                    Enter your email address and we'll send you a link to view
                    and update your notification preferences.
                </p>
                <ErrorAlert error={requestLink.error} />
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
                        text={
                            requestLink.isPending
                                ? "Sending…"
                                : "Email me a link"
                        }
                        disabled={requestLink.isPending}
                    />
                </div>
            </form>
        </PreferencesScreen>
    )
}

const ExpiredLinkScreen = ({ token }: { token: string }) => {
    const requestLink = useRequestLinkMutation()

    if (requestLink.isSuccess) return <LinkSentScreen />

    return (
        <SubscribePageConfirmation
            variant="error"
            heading="This link has expired"
        >
            <p className="subscribe-page__confirmation-text">
                The link you followed is no longer valid. For your security,
                preference links are only valid for 30 minutes. We can email you
                a new one.
            </p>
            <ErrorAlert error={requestLink.error} />
            <Button
                className="subscribe-page__confirmation-action"
                theme="outline-vermillion"
                icon={null}
                text={
                    requestLink.isPending ? "Sending…" : "Email me a new link"
                }
                disabled={requestLink.isPending}
                onClick={() => requestLink.mutate({ token })}
            />
        </SubscribePageConfirmation>
    )
}

const InvalidLinkScreen = () => (
    <SubscribePageConfirmation variant="error" heading="This link is not valid">
        <p className="subscribe-page__confirmation-text">
            The link you followed is not valid. Please use the link from our
            most recent email, or request a new one.
        </p>
        <Button
            className="subscribe-page__confirmation-action"
            theme="outline-vermillion"
            icon={null}
            href="/subscribe/preferences"
            text="Request a new link"
        />
    </SubscribePageConfirmation>
)

type TokenLookup =
    | { state: "expired" }
    | { state: "invalid" }
    | {
          state: "valid"
          email: string
          subscribedToTopicNotifications: boolean
          preferences: EmailNotificationsPreferences | null
          subscribedToOwidBrief: boolean | null
      }

async function fetchPreferences(token: string): Promise<TokenLookup> {
    const response = await apiGet("/preferences", { token })
    if (response.status === 410) return { state: "expired" }
    if (!response.ok) return { state: "invalid" }
    const json: EmailNotificationsPreferencesResponse = await response.json()
    if (!json.email || !json.emailNotificationsStatus)
        return { state: "invalid" }
    return {
        state: "valid",
        email: json.email,
        subscribedToTopicNotifications:
            json.emailNotificationsStatus === "subscribed",
        preferences: json.preferences ?? null,
        subscribedToOwidBrief: json.subscribedToOwidBrief ?? null,
    }
}

type TokenScreenResult = "saved" | "unsubscribed" | "expired"

const TokenScreen = ({
    token,
    topicAreaNames,
}: {
    token: string
    topicAreaNames: string[]
}) => {
    const [result, setResult] = useState<TokenScreenResult | null>(null)
    const lookup = useQuery({
        queryKey: ["email-notifications-preferences", token],
        queryFn: () => fetchPreferences(token),
        retry: false,
        staleTime: Infinity,
    })

    if (result) {
        return match(result)
            .with("saved", () => (
                <SubscribePageConfirmation heading="Preferences updated">
                    <p className="subscribe-page__confirmation-text">
                        Your email preferences have been saved.
                    </p>
                </SubscribePageConfirmation>
            ))
            .with("unsubscribed", () => (
                <SubscribePageConfirmation heading="You have been successfully unsubscribed">
                    <p className="subscribe-page__confirmation-text">
                        You will no longer receive emails from us. You can
                        resubscribe any time.
                    </p>
                    <Button
                        className="subscribe-page__confirmation-action"
                        theme="outline-vermillion"
                        icon={null}
                        href="/subscribe"
                        text="Resubscribe"
                    />
                </SubscribePageConfirmation>
            ))
            .with("expired", () => <ExpiredLinkScreen token={token} />)
            .exhaustive()
    }

    if (lookup.isPending) {
        return (
            <PreferencesScreen>
                <p>Loading your preferences…</p>
            </PreferencesScreen>
        )
    }
    if (lookup.isError) return <InvalidLinkScreen />

    return match(lookup.data)
        .with({ state: "expired" }, () => <ExpiredLinkScreen token={token} />)
        .with({ state: "invalid" }, () => <InvalidLinkScreen />)
        .with({ state: "valid" }, (data) => (
            <PreferencesEditor
                token={token}
                topicAreaNames={topicAreaNames}
                email={data.email}
                initialPreferences={data.preferences}
                initialSubscribedToTopicNotifications={
                    data.subscribedToTopicNotifications
                }
                initialSubscribedToOwidBrief={data.subscribedToOwidBrief}
                onDone={setResult}
            />
        ))
        .exhaustive()
}

const PreferencesEditor = ({
    token,
    topicAreaNames,
    email,
    initialPreferences,
    initialSubscribedToTopicNotifications,
    initialSubscribedToOwidBrief,
    onDone,
}: {
    token: string
    topicAreaNames: string[]
    email: string
    initialPreferences: EmailNotificationsPreferences | null
    initialSubscribedToTopicNotifications: boolean
    // null = Mailchimp unavailable, so the Brief control is disabled.
    initialSubscribedToOwidBrief: boolean | null
    onDone: (result: TokenScreenResult) => void
}) => {
    const preferences = useNotificationPreferences(
        topicAreaNames,
        initialPreferences
    )
    const [subscribedToTopicNotifications, setSubscribedToTopicNotifications] =
        useState(initialSubscribedToTopicNotifications)
    const [subscribedToOwidBrief, setSubscribedToOwidBrief] = useState(
        initialSubscribedToOwidBrief
    )

    const update = useMutation({
        mutationFn: async (
            request: EmailNotificationsUpdatePreferencesRequest
        ) => {
            const response = await apiPost("/preferences", request)
            if (response.status === 410) return "expired" as const
            await throwIfApiError(response)
            return !request.subscribeToTopicNotifications &&
                request.subscribeToOwidBrief === false
                ? "unsubscribed"
                : "saved"
        },
        onSuccess: onDone,
    })

    const handleSave = (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        preferences.resetValidation()
        if (subscribedToTopicNotifications && !preferences.validate()) return
        const commonRequest = {
            token,
            // Only included when the toggle was shown.
            subscribeToOwidBrief: subscribedToOwidBrief ?? undefined,
        }
        update.mutate(
            subscribedToTopicNotifications
                ? {
                      ...commonRequest,
                      subscribeToTopicNotifications: true,
                      preferences: preferences.forStorage(),
                  }
                : {
                      ...commonRequest,
                      subscribeToTopicNotifications: false,
                  }
        )
    }

    const handleUnsubscribe = () => {
        preferences.resetValidation()
        update.mutate({
            token,
            subscribeToTopicNotifications: false,
            subscribeToOwidBrief: false,
        })
    }

    return (
        <PreferencesScreen>
            <form
                className="email-notifications-preferences-form"
                onSubmit={handleSave}
            >
                <p>
                    Updating the email notification preferences for{" "}
                    <strong>{email}</strong>.
                </p>
                <fieldset className="newsletter-form__fieldset">
                    <legend className="h5-black-caps">Newsletters</legend>
                    <Checkbox
                        id="email-notifications-preferences-follow-topics"
                        label="Follow Topics — receive updates on the topics you follow as we publish them."
                        checked={subscribedToTopicNotifications}
                        onChange={() =>
                            setSubscribedToTopicNotifications(
                                !subscribedToTopicNotifications
                            )
                        }
                    />
                    {subscribedToOwidBrief !== null && (
                        <Checkbox
                            id="email-notifications-preferences-owid-brief"
                            label="The OWID Brief — stay up to date with our latest work plus curated highlights from across Our World in Data, twice a month."
                            checked={subscribedToOwidBrief}
                            onChange={() =>
                                setSubscribedToOwidBrief(!subscribedToOwidBrief)
                            }
                        />
                    )}
                </fieldset>
                {subscribedToTopicNotifications && (
                    <EmailNotificationsPreferenceFields
                        {...preferences.fieldsProps}
                    />
                )}
                {subscribedToOwidBrief === null && (
                    <div className="newsletter-form__alert">
                        We couldn't load your OWID Brief subscription. You can
                        still update Follow Topics, or try again later to manage
                        the Brief.
                    </div>
                )}
                <ErrorAlert error={update.error} />
                <div className="email-notifications-preferences-form__actions">
                    <Button
                        type="submit"
                        theme="solid-vermillion"
                        icon={null}
                        text={update.isPending ? "Saving…" : "Save preferences"}
                        disabled={update.isPending}
                    />
                    {subscribedToOwidBrief !== null && (
                        <button
                            type="button"
                            className="email-notifications-preferences-form__unsubscribe"
                            disabled={update.isPending}
                            onClick={handleUnsubscribe}
                        >
                            Unsubscribe from all email notifications
                        </button>
                    )}
                </div>
            </form>
        </PreferencesScreen>
    )
}
