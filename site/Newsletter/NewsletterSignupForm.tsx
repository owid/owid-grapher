import { NewsletterSpamProtection } from "./NewsletterSpamProtection.js"
import { useNewsletterSpamProtection } from "./useNewsletterSpamProtection.js"
import { useState } from "react"
import * as React from "react"
import cx from "clsx"
import { useMutation } from "@tanstack/react-query"
import { Button, TextInput } from "@ourworldindata/components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCheck } from "@fortawesome/free-solid-svg-icons"
import { EmailNotificationsSubscribeRequest } from "@ourworldindata/types"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"
import { SiteQueryClientProvider } from "../SiteQueryClientProvider.js"
import {
    apiPost,
    getErrorMessage,
    throwIfApiError,
} from "./emailNotificationsApi.js"
import { NewsletterOption } from "./NewsletterOption.js"
import { storeSubscribePrefill } from "./subscribePrefill.js"
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

/**
 * The compact signup form shown in the header, the floating button, the
 * homepage and /latest once email notifications are enabled.
 *
 * The OWID Brief alone subscribes in place through our API (which adds the
 * address to Mailchimp). "Follow Topics" needs the topic and cadence controls
 * that only /subscribe has, so it hands the email and Brief choice over to
 * that page instead of subscribing here.
 */
export const NewsletterSignupForm = (props: {
    context: NewsletterSubscriptionContext
    className?: string
}) => (
    // The floating site-tools mount has no query client above it.
    <SiteQueryClientProvider>
        <NewsletterSignupFormInner {...props} />
    </SiteQueryClientProvider>
)

const NewsletterSignupFormInner = ({
    context,
    className,
}: {
    context: NewsletterSubscriptionContext
    className?: string
}) => {
    const [subscribeToOwidBrief, setSubscribeToOwidBrief] = useState(true)
    const [followTopics, setFollowTopics] = useState(false)
    const {
        ref: captchaRef,
        captchaToken,
        setCaptchaToken,
        resetCaptcha,
        spamProtectionFields,
    } = useNewsletterSpamProtection()
    const [email, setEmail] = useState("")
    const [hasEditedEmail, setHasEditedEmail] = useState(false)

    const subscribe = useMutation({
        mutationFn: async (request: EmailNotificationsSubscribeRequest) => {
            const response = await apiPost("/subscribe", request)
            await throwIfApiError(response)
        },
        onSuccess: () => {
            analytics.logSiteFormSubmit(
                "newsletter-subscribe",
                `Subscribe [${context}]`
            )
        },
        onError: (error) => {
            analytics.logNewsletterSubscribeError(
                context,
                getErrorMessage(error)
            )
            resetCaptcha()
        },
    })

    const isSubmittable = subscribeToOwidBrief || followTopics
    const showCaptcha =
        hasEditedEmail &&
        ((subscribeToOwidBrief && !followTopics) || !!captchaToken)

    const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!isSubmittable || subscribe.isPending) return
        const trimmedEmail = email.trim()

        if (followTopics) {
            analytics.logSiteClick(
                "newsletter-follow-topics-handoff",
                `Subscribe [${context}]`
            )
            storeSubscribePrefill({ email: trimmedEmail, subscribeToOwidBrief })
            window.location.assign("/subscribe")
            return
        }

        if (!captchaToken) return
        subscribe.mutate({
            ...spamProtectionFields(event.currentTarget),
            email: trimmedEmail,
            subscribeToOwidBrief,
        })
    }

    if (subscribe.isSuccess)
        return (
            <div
                className={cx("newsletter-signup-form__success", className)}
                role="status"
            >
                <span
                    className="newsletter-signup-form__success-icon"
                    aria-hidden="true"
                >
                    <FontAwesomeIcon icon={faCheck} />
                </span>
                <span>Your subscription to The OWID Brief is active.</span>
            </div>
        )

    // The submit button stays disabled until a captcha token arrives, so the
    // form needs JavaScript: there is no native fallback before hydration.
    return (
        <form
            className={cx("newsletter-signup-form", className)}
            onSubmit={handleSubmit}
        >
            <NewsletterOption
                id={`newsletter-signup-brief-${context}`}
                title={OWID_BRIEF_TITLE}
                cadence={OWID_BRIEF_CADENCE}
                description={OWID_BRIEF_DESCRIPTION}
                checked={subscribeToOwidBrief}
                disabled={subscribe.isPending}
                onChange={() => setSubscribeToOwidBrief(!subscribeToOwidBrief)}
            />
            <NewsletterOption
                id={`newsletter-signup-topics-${context}`}
                title={FOLLOW_TOPICS_TITLE}
                cadence={
                    followTopics
                        ? "Choose topics in next step"
                        : FOLLOW_TOPICS_CADENCE
                }
                description={FOLLOW_TOPICS_DESCRIPTION}
                checked={followTopics}
                disabled={subscribe.isPending}
                onChange={() => setFollowTopics(!followTopics)}
            />
            {!isSubmittable && (
                <div className="newsletter-signup-form__alert">
                    Please select at least one option.
                </div>
            )}
            {subscribe.error && (
                <div className="newsletter-signup-form__alert">
                    {getErrorMessage(subscribe.error)}
                </div>
            )}
            <TextInput
                className="newsletter-signup-form__email sentry-mask"
                type="email"
                autoComplete="email"
                placeholder="Your email address"
                required={true}
                value={email}
                disabled={subscribe.isPending}
                onChange={(event) => {
                    setHasEditedEmail(true)
                    setEmail(event.target.value)
                }}
            />
            {showCaptcha && (
                <NewsletterSpamProtection
                    ref={captchaRef}
                    onToken={setCaptchaToken}
                />
            )}
            <Button
                className="newsletter-signup-form__submit"
                type="submit"
                theme="solid-vermillion"
                icon={null}
                disabled={
                    !isSubmittable ||
                    subscribe.isPending ||
                    (!followTopics && !captchaToken)
                }
                text={
                    followTopics
                        ? "See subscription options"
                        : subscribe.isPending
                          ? "Subscribing…"
                          : "Subscribe"
                }
            />
            <PrivacyNotice className="newsletter-signup-form__privacy-notice" />
        </form>
    )
}
