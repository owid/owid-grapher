import { FEATURE_FLAGS, Features } from "../settings/clientSettings.mjs"

export function hasTopicNewsletterCard(
    topicArea: string | undefined
): topicArea is string {
    return !!topicArea && FEATURE_FLAGS.includes(Features.EmailNotifications)
}
