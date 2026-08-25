import { FEATURE_FLAGS, Features } from "../settings/clientSettings.js"

/** Whether a page with this topic area renders the topic newsletter card. */
export function hasTopicNewsletterCard(
    topicArea: string | undefined
): topicArea is string {
    return !!topicArea && FEATURE_FLAGS.has(Features.EmailNotifications)
}
