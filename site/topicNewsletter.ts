import { FEATURE_FLAGS, Features } from "../settings/clientSettings.js"

export function hasTopicNewsletterCard(
    topicArea: string | undefined
): topicArea is string {
    return !!topicArea && FEATURE_FLAGS.has(Features.EmailNotifications)
}
