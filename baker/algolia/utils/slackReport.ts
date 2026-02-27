import type { KnownBlock } from "@slack/web-api"
import { postToSlack } from "../../../serverUtils/slackClient.js"
import { SLACK_ALGOLIA_INDEXING_CHANNEL_ID } from "../../../settings/serverSettings.js"
import type { FeaturedMetricFailure } from "./shared.js"
import { unique } from "remeda"

export async function reportFeaturedMetricFailuresToSlack(
    failures: FeaturedMetricFailure[]
): Promise<void> {
    if (failures.length === 0) return

    const uniqueUrls = unique(failures.map((f) => f.url))
    const bullets = uniqueUrls.map((url) => `• ${url}`)

    const sections: string[] = []
    const MAX_SECTION_LENGTH = 3000 // Slack's block text limit
    let currentChunk: string[] = []
    let currentLength = 0

    for (const bullet of bullets) {
        if (
            currentChunk.length > 0 &&
            currentLength + bullet.length + 1 > MAX_SECTION_LENGTH
        ) {
            sections.push(currentChunk.join("\n"))
            currentChunk = []
            currentLength = 0
        }
        currentChunk.push(bullet)
        currentLength += bullet.length + 1 // +1 for the newline
    }
    if (currentChunk.length > 0) {
        sections.push(currentChunk.join("\n"))
    }

    const bulletBlocks: KnownBlock[] = sections.map((sectionText) => ({
        type: "section",
        text: {
            type: "mrkdwn" as const,
            text: sectionText,
        },
    }))

    const blocks: KnownBlock[] = [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: "Algolia Featured Metric Indexing Failures",
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn" as const,
                text: `The following featured metrics failed to match during Algolia indexing. <https://admin.owid.io/admin/featured-metrics|Please investigate and fix the underlying issues> to ensure these metrics are properly indexed.`,
            },
        },
        ...bulletBlocks,
    ]

    const fallbackText = `Algolia Featured Metric Indexing Failures: ${uniqueUrls.length} featured metric(s) failed to match`

    await postToSlack(SLACK_ALGOLIA_INDEXING_CHANNEL_ID, blocks, fallbackText)
}
