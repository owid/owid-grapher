import { useRef, useState } from "react"
import { flushSync } from "react-dom"
import {
    EMAIL_NOTIFICATIONS_CONTENT_TYPES,
    EmailNotificationsContentType,
    EmailNotificationsFrequency,
    EmailNotificationsPreferences,
    TopicAreaName,
} from "@ourworldindata/types"
import { EmailNotificationsPreferenceFieldsProps } from "./EmailNotificationsPreferenceFields.js"
import {
    getPreferencesValidationErrors,
    PreferencesValidationErrors,
    topicTagsForStorage,
    topicTagsFromStorage,
} from "./emailNotificationsValidation.js"
import { scrollAlertIntoView } from "./scrollAlertIntoView.js"

/**
 * Announcements are opt-in: they are topic-independent news about Our World in
 * Data itself, rather than the published work most subscribers are here for.
 */
export const DEFAULT_CONTENT_TYPES: EmailNotificationsContentType[] =
    EMAIL_NOTIFICATIONS_CONTENT_TYPES.filter(
        (contentType) => contentType !== "announcement"
    )

export const DEFAULT_FREQUENCY: EmailNotificationsFrequency = "weekly"

function toggleInArray<T>(items: T[], item: T): T[] {
    return items.includes(item)
        ? items.filter((candidate) => candidate !== item)
        : [...items, item]
}

interface NotificationPreferencesState {
    /** Spread onto <EmailNotificationsPreferenceFields>. */
    fieldsProps: EmailNotificationsPreferenceFieldsProps
    setTopicTags: (topicTags: TopicAreaName[]) => void
    /** The shape the API stores, with "all topics" collapsed to []. */
    forStorage: () => EmailNotificationsPreferences
    /**
     * Records per-field errors, scrolls the first one into view and returns
     * whether the selection is valid.
     */
    validate: () => boolean
    resetValidation: () => void
}

/**
 * The preference state shared by the subscribe form and the magic-link
 * preferences form: both edit the same fields, from the same defaults, through
 * the same <EmailNotificationsPreferenceFields>. The preferences form passes
 * the stored preferences to prefill from.
 */
export function useNotificationPreferences(
    initialPreferences?: EmailNotificationsPreferences | null
): NotificationPreferencesState {
    // New subscribers pick their topics; stored preferences present the
    // empty-means-all-topics shape with every pill selected.
    const [topicTags, setTopicTags] = useState<TopicAreaName[]>(() =>
        initialPreferences
            ? topicTagsFromStorage(initialPreferences.topicTags)
            : []
    )
    const [contentTypes, setContentTypes] = useState<
        EmailNotificationsContentType[]
    >(() => [...(initialPreferences?.contentTypes ?? DEFAULT_CONTENT_TYPES)])
    const [frequency, setFrequency] = useState<EmailNotificationsFrequency>(
        initialPreferences?.frequency ?? DEFAULT_FREQUENCY
    )
    const [validationErrors, setValidationErrors] =
        useState<PreferencesValidationErrors | null>(null)
    // The submit button sits below the fieldsets, so a failed submit may
    // leave the error off-screen.
    const firstAlertRef = useRef<HTMLDivElement>(null)

    return {
        fieldsProps: {
            topicTags,
            contentTypes,
            frequency,
            onToggleTopicTag: (tagName) =>
                setTopicTags((current) => toggleInArray(current, tagName)),
            onToggleContentType: (contentType) =>
                setContentTypes((current) =>
                    toggleInArray(current, contentType)
                ),
            onSetFrequency: setFrequency,
            validationErrors,
            firstAlertRef,
        },
        setTopicTags,
        forStorage: () => ({
            topicTags: topicTagsForStorage(topicTags),
            contentTypes,
            frequency,
        }),
        validate: () => {
            const errors = getPreferencesValidationErrors(
                topicTags,
                contentTypes
            )
            flushSync(() => setValidationErrors(errors))
            if (errors) scrollAlertIntoView(firstAlertRef.current)
            return !errors
        },
        resetValidation: () => setValidationErrors(null),
    }
}
