import { useState } from "react"
import * as React from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faBook,
    faBullhorn,
    faChartLine,
    faCheck,
    faMinus,
    faLightbulb,
    faPlus,
    IconDefinition,
} from "@fortawesome/free-solid-svg-icons"
import {
    EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS,
    EMAIL_NOTIFICATIONS_FREQUENCIES,
    EMAIL_NOTIFICATIONS_FREQUENCY_LABELS,
    EmailNotificationsContentType,
    EmailNotificationsFrequency,
    EmailNotificationsSubscribeRequest,
    EmailNotificationsSubscribeResponse,
    TagGraphRoot,
} from "@ourworldindata/types"
import { Checkbox, TextInput } from "@ourworldindata/components"
import { EMAIL_NOTIFICATIONS_API_BASE_URL } from "../settings/clientSettings.js"
import { SiteAnalytics } from "./SiteAnalytics.js"
import {
    getPreferencesValidationErrors,
    PreferencesValidationErrors,
    topicTagsForStorage,
} from "./emailNotificationsValidation.js"

const analytics = new SiteAnalytics()

// The content types offered as "Show me" cards.
const CONTENT_TYPE_CARDS: {
    contentType: EmailNotificationsContentType
    icon: IconDefinition
    description: string
}[] = [
    {
        contentType: "article",
        icon: faBook,
        description:
            "Longer-form narrative pieces. Published twice a month approximately.",
    },
    {
        contentType: "data-insight",
        icon: faLightbulb,
        description:
            "Bite-sized insights on how the world is changing. Published every few days.",
    },
    {
        contentType: "data-update",
        icon: faChartLine,
        // TODO: provisional copy — the design has a placeholder here.
        description:
            "Major updates to the datasets behind our work. Published once or twice a week.",
    },
    {
        contentType: "announcement",
        icon: faBullhorn,
        // TODO: provisional copy — this card isn't in the design yet.
        description:
            "News about Our World in Data itself. Independent of the topics you follow.",
    },
]

const TogglePill = ({
    label,
    selected,
    onToggle,
}: {
    label: string
    selected: boolean
    onToggle: () => void
}) => (
    <button
        type="button"
        className={cx("email-notifications-subscribe-form__pill", {
            "email-notifications-subscribe-form__pill--selected": selected,
        })}
        aria-pressed={selected}
        onClick={onToggle}
    >
        <FontAwesomeIcon icon={selected ? faCheck : faPlus} />
        {label}
    </button>
)

const ContentTypeCard = ({
    icon,
    title,
    description,
    selected,
    onToggle,
}: {
    icon: IconDefinition
    title: string
    description: string
    selected: boolean
    onToggle: () => void
}) => (
    <button
        type="button"
        className={cx("email-notifications-subscribe-form__card", {
            "email-notifications-subscribe-form__card--selected": selected,
        })}
        aria-pressed={selected}
        onClick={onToggle}
    >
        <span className="email-notifications-subscribe-form__card-header">
            <FontAwesomeIcon icon={icon} />
            <div
                className={cx({
                    "email-notifications-subscribe-form__checkbox": true,
                    "email-notifications-subscribe-form__checkbox--selected":
                        selected,
                })}
            >
                {selected && <FontAwesomeIcon icon={faCheck} />}
            </div>
        </span>
        <span className="email-notifications-subscribe-form__card-title">
            {title}
        </span>
        <span className="email-notifications-subscribe-form__card-description">
            {description}
        </span>
    </button>
)

/**
 * The topics / content types / frequency fieldsets, shared between the
 * subscribe form and the magic-link preferences form.
 */
export const EmailNotificationsPreferenceFields = ({
    topicTagGraph,
    topicTags,
    contentTypes,
    frequency,
    onToggleTopicTag,
    onToggleContentType,
    onSetFrequency,
    validationErrors,
}: {
    topicTagGraph: TagGraphRoot
    topicTags: string[]
    contentTypes: EmailNotificationsContentType[]
    frequency: EmailNotificationsFrequency
    onToggleTopicTag: (tagName: string) => void
    onToggleContentType: (contentType: EmailNotificationsContentType) => void
    onSetFrequency: (frequency: EmailNotificationsFrequency) => void
    validationErrors?: PreferencesValidationErrors | null
}) => {
    const allTopicsSelected = topicTagGraph.children.every((area) =>
        topicTags.includes(area.name)
    )

    // The toggle callbacks use functional state updates, so toggling every
    // affected pill in sequence composes correctly.
    const toggleAllTopics = () => {
        for (const area of topicTagGraph.children) {
            if (topicTags.includes(area.name) === allTopicsSelected)
                onToggleTopicTag(area.name)
        }
    }

    return (
        <>
            <fieldset className="email-notifications-subscribe-form__fieldset">
                <legend className="h6-black-caps">I want updates about</legend>
                <div className="email-notifications-subscribe-form__pills">
                    {topicTagGraph.children.map((area) => (
                        <TogglePill
                            key={area.name}
                            label={area.name}
                            selected={topicTags.includes(area.name)}
                            onToggle={() => onToggleTopicTag(area.name)}
                        />
                    ))}
                </div>
                <button
                    type="button"
                    className="email-notifications-subscribe-form__select-all"
                    onClick={toggleAllTopics}
                >
                    <FontAwesomeIcon
                        icon={allTopicsSelected ? faMinus : faPlus}
                    />
                    <span>
                        {allTopicsSelected
                            ? "Deselect all topics"
                            : "Select all topics"}
                    </span>
                </button>
                {validationErrors?.topicTagsError && (
                    <div className="email-notifications-subscribe-form__alert">
                        {validationErrors.topicTagsError}
                    </div>
                )}
            </fieldset>
            <fieldset className="email-notifications-subscribe-form__fieldset">
                <legend className="h6-black-caps">Show me</legend>
                <div className="email-notifications-subscribe-form__cards">
                    {CONTENT_TYPE_CARDS.map(
                        ({ contentType, icon, description }) => (
                            <ContentTypeCard
                                key={contentType}
                                icon={icon}
                                title={
                                    EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS[
                                        contentType
                                    ]
                                }
                                description={description}
                                selected={contentTypes.includes(contentType)}
                                onToggle={() =>
                                    onToggleContentType(contentType)
                                }
                            />
                        )
                    )}
                </div>
                {validationErrors?.contentTypesError && (
                    <div className="email-notifications-subscribe-form__alert">
                        {validationErrors.contentTypesError}
                    </div>
                )}
            </fieldset>
            <fieldset className="email-notifications-subscribe-form__fieldset">
                <legend className="h6-black-caps">Send me, at most</legend>
                <div className="email-notifications-subscribe-form__frequency-options">
                    {EMAIL_NOTIFICATIONS_FREQUENCIES.map((frequencyOption) => (
                        <label
                            key={frequencyOption}
                            className={cx(
                                "email-notifications-subscribe-form__frequency-option",
                                {
                                    "email-notifications-subscribe-form__frequency-option--selected":
                                        frequency === frequencyOption,
                                }
                            )}
                        >
                            <input
                                type="radio"
                                name="email-notifications-frequency"
                                value={frequencyOption}
                                checked={frequency === frequencyOption}
                                onChange={() => onSetFrequency(frequencyOption)}
                            />
                            {
                                EMAIL_NOTIFICATIONS_FREQUENCY_LABELS[
                                    frequencyOption
                                ]
                            }
                        </label>
                    ))}
                </div>
                <p className="email-notifications-subscribe-form__hint note-12-medium">
                    If we haven't published anything matching your preferences,
                    you won't hear from us.
                </p>
            </fieldset>
        </>
    )
}

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
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const [email, setEmail] = useState("")
    const [subscribeToOwidBrief, setSubscribeToOwidBrief] = useState(true)
    const [followTopics, setFollowTopics] = useState(true)
    const [topicTags, setTopicTags] = useState<string[]>(() =>
        topicTagGraph.children.map((area) => area.name)
    )
    const [contentTypes, setContentTypes] = useState<
        EmailNotificationsContentType[]
    >(
        CONTENT_TYPE_CARDS.map((card) => card.contentType).filter(
            (contentType) => contentType !== "announcement"
        )
    )
    const [frequency, setFrequency] =
        useState<EmailNotificationsFrequency>("weekly")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [validationErrors, setValidationErrors] =
        useState<PreferencesValidationErrors | null>(null)

    const toggleContentType = (contentType: EmailNotificationsContentType) => {
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

    const onSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        setErrorMessage(null)
        setValidationErrors(null)

        const trimmedEmail = email.trim()
        if (!trimmedEmail) {
            setErrorMessage("Please enter your email address.")
            return
        }
        if (!followTopics && !subscribeToOwidBrief) {
            setErrorMessage("Please select at least one newsletter.")
            return
        }
        if (followTopics) {
            const errors = getPreferencesValidationErrors(
                topicTags,
                contentTypes
            )
            if (errors) {
                setValidationErrors(errors)
                return
            }
        }

        const request: EmailNotificationsSubscribeRequest = {
            email: trimmedEmail,
            notifications: followTopics
                ? {
                      topicTags: topicTagsForStorage(topicTags, topicTagGraph),
                      contentTypes,
                      frequency,
                  }
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
                <h3 className="h3-bold">Check your inbox</h3>
                <p>
                    We've sent an email to {email}. If you're new, it's a
                    welcome email — you're all set. If this address already had
                    a subscription, it contains a link to apply the preferences
                    you just chose; until you click it, nothing changes.
                </p>
            </div>
        )
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
                    topicTagGraph={topicTagGraph}
                    topicTags={topicTags}
                    contentTypes={contentTypes}
                    frequency={frequency}
                    onToggleTopicTag={toggleTopicTag}
                    onToggleContentType={toggleContentType}
                    onSetFrequency={setFrequency}
                    validationErrors={validationErrors}
                />
            )}
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
