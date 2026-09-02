import { getRegionByNameOrVariantName } from "@ourworldindata/utils"
import {
    DEFAULT_TOPIC_VOCABULARY_URL,
    TOPIC_VOCABULARY_URL,
} from "../../settings/clientSettings.js"

// The vocabulary as published: keyed by topic slug, each entry carrying the
// topic's name, its keywords, and generation stats we have no use for here.
interface PublishedTopicVocabularyEntry {
    topic_name?: string
    keywords?: string[]
}

/** Topic name → the terms to suggest for it, in the order to suggest them. */
export type TopicVocabulary = Record<string, string[]>

export const topicVocabularyQueryKey = (url: string): [string, string] => [
    "topicVocabulary",
    url,
]

/**
 * Re-keys the published vocabulary by topic *name*.
 *
 * It is published keyed by slug, because that's what generated it, but its
 * consumers know a topic by the tag name their gdoc carries — an all-charts
 * block receives only `topicName`, and builds its Algolia filter from that name
 * too. Every topic tag with a published chart has exactly one entry whose
 * `topic_name` matches that tag's name, since both sides come from `tags.name`.
 *
 * Entries are read defensively: this is a file in a bucket, regenerated out of
 * band by a script in another repo (and pointed at a different key entirely on
 * a staging server), so a malformed or half-written entry should cost that one
 * topic its suggestions rather than throw inside a render.
 */
export function indexTopicVocabularyByName(data: unknown): TopicVocabulary {
    if (typeof data !== "object" || data === null) return {}

    const vocabulary: TopicVocabulary = {}
    for (const entry of Object.values(data)) {
        const { topic_name: topicName, keywords } =
            (entry as PublishedTopicVocabularyEntry) ?? {}
        if (typeof topicName !== "string" || !topicName) continue
        if (!Array.isArray(keywords)) continue
        vocabulary[topicName] = keywords.filter(
            (keyword): keyword is string =>
                typeof keyword === "string" && keyword.length > 0
        )
    }
    return vocabulary
}

async function fetchVocabularyFrom(url: string): Promise<TopicVocabulary> {
    const response = await fetch(url)
    if (!response.ok)
        throw new Error(
            `Failed to fetch the topic vocabulary from ${url}: ${response.status}`
        )
    return indexTopicVocabularyByName(await response.json())
}

/**
 * Fetches the topic vocabulary, falling back to the production one when a
 * staging server has been pointed at a key that isn't there (see
 * TOPIC_VOCABULARY_URL). Suggestions are a nice-to-have on the page, so an
 * override that hasn't been generated yet should leave them looking like
 * production rather than empty.
 */
export async function fetchTopicVocabulary(): Promise<TopicVocabulary> {
    try {
        return await fetchVocabularyFrom(TOPIC_VOCABULARY_URL)
    } catch (error) {
        if (TOPIC_VOCABULARY_URL === DEFAULT_TOPIC_VOCABULARY_URL) throw error
        console.warn(
            `${String(error)} — falling back to ${DEFAULT_TOPIC_VOCABULARY_URL}`
        )
        return await fetchVocabularyFrom(DEFAULT_TOPIC_VOCABULARY_URL)
    }
}

// True for anything that names a place: a country, a continent, an aggregate
// like "World", or a variant name for one of those ("US", "UK"). Suggested
// searches deliberately don't include places — they offer ways of narrowing
// *what* the charts are about, and a country derived from the whole topic just
// sits there while the visitor searches for a different one. Searching by
// country still works, it just isn't suggested. This is the same lookup the
// rest of the site uses to recognise one, so variants and non-country regions
// are covered without a hand-written list of names.
//
// The vocabulary is asked not to name places, and currently names none, but it
// is regenerated out of band by a script in another repo and successive
// generations have drifted in and out of offering "United States" or "Ukraine".
// Enforcing it here keeps that drift off the page, at the cost of one shorter
// line on whichever topic drifts.
function isPlaceName(name: string): boolean {
    return getRegionByNameOrVariantName(name) !== undefined
}

/**
 * The all-charts block's "Suggested:" terms for a topic, in the order they are
 * shown.
 *
 * The vocabulary decides both which terms those are and what order they go in,
 * and this deliberately does nothing to either. Its generator
 * (`scripts/vocabulary/vocabulary.py` in owid/etl) chooses them by measuring
 * what each one actually reveals of the very chart list this block renders,
 * weighted by how much each chart is viewed, taking the term that reveals the
 * most and then whichever adds the most that is still hidden. It publishes as
 * many as the line shows.
 *
 * This block used to re-rank them, from the topic's default result set, back
 * when the vocabulary was an unordered pile of ~30 candidates per topic. That
 * is worth remembering as a thing not to reintroduce: the block can only see
 * one topic's rows, unweighted, and cannot see what a search would return, so
 * re-ranking a measured list from here made it worse — it rewrote 100 of 125
 * topics and 54 of their opening terms, for no gain that could be measured.
 *
 * Place names are the one exception, and the reason this isn't just a property
 * access. See isPlaceName.
 */
export function suggestedKeywords(keywords: string[] | undefined): string[] {
    return (keywords ?? []).filter((keyword) => !isPlaceName(keyword))
}
