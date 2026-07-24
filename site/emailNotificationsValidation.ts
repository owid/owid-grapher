import { EmailNotificationsContentType } from "@ourworldindata/types"

export interface PreferencesValidationErrors {
    topicTagsError: string | null
    contentTypesError: string | null
}

/**
 * Client-side mirror of the preferences schema's refinement (the Cloudflare
 * Function is the authoritative validator): a preferences selection needs at
 * least one content type, and at least one pill — a topic, or the OWID
 * announcements pill, since announcements are not topic-filtered.
 *
 * Returns null when the selection is valid, otherwise per-field messages so
 * each can be rendered next to the fieldset it refers to.
 */
export function getPreferencesValidationErrors(
    topicTags: string[],
    contentTypes: EmailNotificationsContentType[]
): PreferencesValidationErrors | null {
    const topicTagsError =
        topicTags.length === 0 && !contentTypes.includes("announcement")
            ? "Please select at least one topic to follow."
            : null
    const contentTypesError =
        contentTypes.length === 0
            ? "Please select at least one type of content to receive."
            : null
    if (!topicTagsError && !contentTypesError) return null
    return { topicTagsError, contentTypesError }
}
