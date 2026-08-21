import { useState } from "react"
import {
    EMAIL_NOTIFICATIONS_CONTENT_TYPES,
    EmailNotificationsContentType,
    EmailNotificationsFrequency,
    EmailNotificationsPreferences,
} from "@ourworldindata/types"
import { EmailNotificationsPreferenceFieldsProps } from "./EmailNotificationsPreferenceFields.js"
import {
    getPreferencesValidationErrors,
    PreferencesValidationErrors,
    topicTagsForStorage,
    topicTagsFromStorage,
} from "./emailNotificationsValidation.js"

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
    /** The shape the API stores, with "all topics" collapsed to []. */
    forStorage: () => EmailNotificationsPreferences
    /** Records per-field errors and returns whether the selection is valid. */
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
    topicAreaNames: string[],
    initialPreferences?: EmailNotificationsPreferences | null
): NotificationPreferencesState {
    // Every pill starts selected, which is how the empty-means-all-topics
    // storage shape presents itself.
    const [topicTags, setTopicTags] = useState<string[]>(() =>
        topicTagsFromStorage(
            initialPreferences?.topicTags ?? [],
            topicAreaNames
        )
    )
    const [contentTypes, setContentTypes] = useState<
        EmailNotificationsContentType[]
    >(() => [...(initialPreferences?.contentTypes ?? DEFAULT_CONTENT_TYPES)])
    const [frequency, setFrequency] = useState<EmailNotificationsFrequency>(
        initialPreferences?.frequency ?? DEFAULT_FREQUENCY
    )
    const [validationErrors, setValidationErrors] =
        useState<PreferencesValidationErrors | null>(null)

    return {
        fieldsProps: {
            topicAreaNames,
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
        },
        forStorage: () => ({
            topicTags: topicTagsForStorage(topicTags, topicAreaNames),
            contentTypes,
            frequency,
        }),
        validate: () => {
            const errors = getPreferencesValidationErrors(
                topicTags,
                contentTypes
            )
            setValidationErrors(errors)
            return !errors
        },
        resetValidation: () => setValidationErrors(null),
    }
}
