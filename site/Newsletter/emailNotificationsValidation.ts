import { EmailNotificationsContentType } from "@ourworldindata/types"

export function areAllTopicsSelected(
    topicTags: string[],
    topicAreaNames: string[]
): boolean {
    return topicAreaNames.every((name) => topicTags.includes(name))
}

/**
 * "All topics" is stored as an empty topicTags array, so that topic areas
 * added later are automatically included. Translates between that storage
 * shape and the form's pill selection (where every pill is selected).
 */
export function topicTagsForStorage(
    topicTags: string[],
    topicAreaNames: string[]
): string[] {
    return areAllTopicsSelected(topicTags, topicAreaNames) ? [] : topicTags
}

export function topicTagsFromStorage(
    topicTags: string[],
    topicAreaNames: string[]
): string[] {
    return topicTags.length === 0 ? topicAreaNames : topicTags
}

export interface PreferencesValidationErrors {
    topicTagsError: string | null
    contentTypesError: string | null
}

/**
 * Client-side UX validation of the preference fields (the Cloudflare Function
 * is the authoritative validator, but it can't enforce these: an empty
 * topicTags array is how "all topics" is stored, so the server can't tell
 * "nothing selected" from "all topics"):
 * - at least one content type
 * - at least one topic whenever a topic-filtered content type is selected —
 *   only announcements are topic-independent
 *
 * Returns null when the selection is valid, otherwise per-field messages so
 * each can be rendered next to the fieldset it refers to.
 */
export function getPreferencesValidationErrors(
    topicTags: string[],
    contentTypes: EmailNotificationsContentType[]
): PreferencesValidationErrors | null {
    const hasTopicDependentContentType = contentTypes.some(
        (contentType) => contentType !== "announcement"
    )
    const topicTagsError =
        topicTags.length === 0 && hasTopicDependentContentType
            ? "Please select at least one topic to follow."
            : null
    const contentTypesError =
        contentTypes.length === 0
            ? "Please select at least one type of content to receive."
            : null
    if (!topicTagsError && !contentTypesError) return null
    return { topicTagsError, contentTypesError }
}
