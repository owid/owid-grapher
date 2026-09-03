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
    EMAIL_NOTIFICATIONS_CONTENT_TYPES,
    EMAIL_NOTIFICATIONS_FREQUENCIES,
    EMAIL_NOTIFICATIONS_FREQUENCY_LABELS,
    EmailNotificationsContentType,
    EmailNotificationsFrequency,
} from "@ourworldindata/types"
import {
    areAllTopicsSelected,
    PreferencesValidationErrors,
} from "./emailNotificationsValidation.js"

const CONTENT_TYPE_CARDS: Record<
    EmailNotificationsContentType,
    { icon: IconDefinition; description: string }
> = {
    article: {
        icon: faBook,
        description:
            "Longer-form narrative pieces. Published twice a month approximately.",
    },
    "data-insight": {
        icon: faLightbulb,
        description:
            "Bite-sized insights on how the world is changing. Published every few days.",
    },
    "data-update": {
        icon: faChartLine,
        description:
            "Major updates to the datasets behind our work. Published once or twice a week.",
    },
    announcement: {
        icon: faBullhorn,
        description:
            "News about Our World in Data itself. Independent of the topics you follow.",
    },
}

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
        className={cx("newsletter-preference-fields__pill", {
            "newsletter-preference-fields__pill--selected": selected,
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
        className={cx("newsletter-preference-fields__card", {
            "newsletter-preference-fields__card--selected": selected,
        })}
        aria-pressed={selected}
        onClick={onToggle}
    >
        <span className="newsletter-preference-fields__card-header">
            <FontAwesomeIcon icon={icon} />
            <div
                className={cx("newsletter-preference-fields__checkbox", {
                    "newsletter-preference-fields__checkbox--selected":
                        selected,
                })}
            >
                {selected && <FontAwesomeIcon icon={faCheck} />}
            </div>
        </span>
        <span className="newsletter-preference-fields__card-title">
            {title}
        </span>
        <span className="newsletter-preference-fields__card-description">
            {description}
        </span>
    </button>
)

export interface EmailNotificationsPreferenceFieldsProps {
    topicAreaNames: string[]
    topicTags: string[]
    contentTypes: EmailNotificationsContentType[]
    frequency: EmailNotificationsFrequency
    onToggleTopicTag: (tagName: string) => void
    onToggleContentType: (contentType: EmailNotificationsContentType) => void
    onSetFrequency: (frequency: EmailNotificationsFrequency) => void
    validationErrors?: PreferencesValidationErrors | null
}

/**
 * The topics / content types / frequency fieldsets, shared between the
 * subscribe form and the magic-link preferences form.
 */
export const EmailNotificationsPreferenceFields = ({
    topicAreaNames,
    topicTags,
    contentTypes,
    frequency,
    onToggleTopicTag,
    onToggleContentType,
    onSetFrequency,
    validationErrors,
}: EmailNotificationsPreferenceFieldsProps) => {
    const allTopicsSelected = areAllTopicsSelected(topicTags, topicAreaNames)

    // The toggle callbacks use functional state updates, so toggling every
    // affected pill in sequence composes correctly.
    const toggleAllTopics = () => {
        for (const name of topicAreaNames) {
            if (topicTags.includes(name) === allTopicsSelected)
                onToggleTopicTag(name)
        }
    }

    return (
        <>
            <fieldset className="newsletter-form__fieldset">
                <div className="newsletter-preference-fields__header">
                    <legend className="h6-black-caps">
                        I want updates about
                    </legend>
                    <button
                        type="button"
                        className="newsletter-preference-fields__select-all"
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
                </div>
                <div className="newsletter-preference-fields__pills">
                    {topicAreaNames.map((name) => (
                        <TogglePill
                            key={name}
                            label={name}
                            selected={topicTags.includes(name)}
                            onToggle={() => onToggleTopicTag(name)}
                        />
                    ))}
                </div>
                {validationErrors?.topicTagsError && (
                    <div className="newsletter-form__alert">
                        {validationErrors.topicTagsError}
                    </div>
                )}
            </fieldset>
            <fieldset className="newsletter-form__fieldset">
                <legend className="h6-black-caps">Show me</legend>
                <div className="newsletter-preference-fields__cards">
                    {EMAIL_NOTIFICATIONS_CONTENT_TYPES.map((contentType) => (
                        <ContentTypeCard
                            key={contentType}
                            icon={CONTENT_TYPE_CARDS[contentType].icon}
                            title={
                                EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS[
                                    contentType
                                ]
                            }
                            description={
                                CONTENT_TYPE_CARDS[contentType].description
                            }
                            selected={contentTypes.includes(contentType)}
                            onToggle={() => onToggleContentType(contentType)}
                        />
                    ))}
                </div>
                {validationErrors?.contentTypesError && (
                    <div className="newsletter-form__alert">
                        {validationErrors.contentTypesError}
                    </div>
                )}
            </fieldset>
            <fieldset className="newsletter-form__fieldset">
                <legend className="h6-black-caps">Send me, at most</legend>
                <div className="newsletter-preference-fields__frequency-options">
                    {EMAIL_NOTIFICATIONS_FREQUENCIES.map((frequencyOption) => (
                        <label
                            key={frequencyOption}
                            className={cx(
                                "newsletter-preference-fields__frequency-option",
                                {
                                    "newsletter-preference-fields__frequency-option--selected":
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
                <p className="newsletter-preference-fields__hint note-12-medium">
                    If we haven't published anything matching your preferences,
                    you won't hear from us.
                </p>
            </fieldset>
        </>
    )
}
