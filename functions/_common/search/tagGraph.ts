import { TagGraphRoot } from "@ourworldindata/types"
import { Env } from "../env.js"

/**
 * The topic tag graph the site bakes to /topicTagGraph.json; it maps tag
 * names to topic page slugs for topic page recommendations.
 */
export async function fetchTagGraph(
    env: Env,
    baseUrl: string
): Promise<TagGraphRoot> {
    const response = await env.ASSETS.fetch(
        new URL("/topicTagGraph.json", baseUrl)
    )
    if (!response.ok)
        throw new Error(
            `Failed to fetch /topicTagGraph.json: ${response.status}`
        )
    return response.json()
}
