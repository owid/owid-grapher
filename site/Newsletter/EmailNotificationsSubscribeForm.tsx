import { useEffect, useState } from "react"
import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import {
    EmailNotificationsSubscribeRequest,
    LatestUrlParam,
} from "@ourworldindata/types"
import { getWindowUrl, setWindowUrl } from "@ourworldindata/utils"
import { Button, Checkbox, TextInput } from "@ourworldindata/components"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { EmailNotificationsPreferenceFields } from "./EmailNotificationsPreferenceFields.js"
import {
    apiPost,
    getErrorMessage,
    throwIfApiError,
} from "./emailNotificationsApi.js"
import { topicAreasFromSearchParams } from "../search/searchUtils.js"
import { useNotificationPreferences } from "./useNotificationPreferences.js"
import { takeSubscribePrefill } from "./subscribePrefill.js"
import {
    FOLLOW_TOPICS_CADENCE,
    FOLLOW_TOPICS_DESCRIPTION,
    FOLLOW_TOPICS_TITLE,
    OWID_BRIEF_CADENCE,
    OWID_BRIEF_DESCRIPTION,
    OWID_BRIEF_TITLE,
    PrivacyNotice,
} from "./newsletterCopy.js"

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
    followTopics: boolean
    subscribeToOwidBrief: boolean
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
    const { setTopicTags } = preferences

    // The page is baked, so the URL and storage are only known after
    // hydration. The form isn't kept in sync with either afterwards, so both
    // are consumed once.
    useEffect(() => {
        const prefill = takeSubscribePrefill()
        if (prefill) {
            setEmail(prefill.email)
            setSubscribeToOwidBrief(prefill.subscribeToOwidBrief)
            setFollowTopics(true)
        }

        const url = getWindowUrl()
        const topicAreas = topicAreasFromSearchParams(
            new URLSearchParams(url.queryStr),
            topicAreaNames
        )
        if (!topicAreas.length) return
        setTopicTags(topicAreas)
        setWindowUrl(
            url.updateQueryParams({ [LatestUrlParam.TOPICS]: undefined })
        )
    }, [topicAreaNames, setTopicTags])

    const subscribe = useMutation({
        mutationFn: async (request: EmailNotificationsSubscribeRequest) => {
            const response = await apiPost("/subscribe", request)
            await throwIfApiError(response)
        },
        onSuccess: (_, request) => {
            analytics.logSiteFormSubmit(
                "newsletter-subscribe",
                "Subscribe [email-notifications]"
            )
            onSubscribed({
                email: request.email,
                followTopics: request.notifications !== undefined,
                subscribeToOwidBrief: request.subscribeToOwidBrief,
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
                title={OWID_BRIEF_TITLE}
                cadence={OWID_BRIEF_CADENCE}
                description={OWID_BRIEF_DESCRIPTION}
                checked={subscribeToOwidBrief}
                onChange={() => setSubscribeToOwidBrief(!subscribeToOwidBrief)}
            />
            <hr className="email-notifications-subscribe-form__divider" />
            <NewsletterOption
                id="email-notifications-follow-topics"
                imageSrc="/images/data-insights.webp"
                title={FOLLOW_TOPICS_TITLE}
                cadence={FOLLOW_TOPICS_CADENCE}
                description={FOLLOW_TOPICS_DESCRIPTION}
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
            <PrivacyNotice className="email-notifications-subscribe-form__privacy-notice" />
        </form>
    )
}
