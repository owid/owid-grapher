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

/**
 * Re-keys the published vocabulary by topic *name*.
 *
 * It is published keyed by slug, because that's what generated it, but its
 * consumers know a topic by the tag name: a topic filter on the search page is
 * keyed by name, and so is the Algolia facet behind it. Every topic tag with a
 * published chart has exactly one entry whose `topic_name` matches that tag's
 * name, since both sides come from `tags.name`.
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
// *what* the charts are about, and the search page already has a country
// selector for narrowing *where*. Searching by country still works, it just
// isn't suggested. This is the same lookup the rest of the site uses to
// recognise one, so variants and non-country regions are covered without a
// hand-written list of names.
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
 * A topic's suggested search terms, in the order they are shown.
 *
 * The vocabulary decides both which terms those are and what order they go in,
 * and this deliberately does nothing to either. Its generator
 * (`scripts/vocabulary/vocabulary.py` in owid/etl) chooses them by measuring
 * what each one reveals of that topic's chart list, weighted by how much each
 * chart is viewed, taking the term that reveals the most and then whichever
 * adds the most that is still hidden. So its first terms are its best ones,
 * and re-ranking them from here — with no view of what a search would return —
 * has been tried and made them worse.
 *
 * Two kinds of term are dropped rather than reordered, both because they are
 * generated for a surface that isn't this one:
 *
 * - Places. Suggested searches offer ways of narrowing *what* the charts are
 *   about, and the search page has a country selector for narrowing *where*.
 *   See isPlaceName.
 * - The topic's own name. It is a fine term to filter a topic page's chart list
 *   by, which is what the vocabulary was generated for, but as a chip offered
 *   under a search box that already contains that word it reads as a mistake:
 *   27 of the 125 topics publish one, "Obesity" suggesting "obesity" among
 *   them. No topic is left with no terms once they are dropped.
 */
export function suggestedKeywords(
    topicName: string,
    keywords: string[] | undefined
): string[] {
    return (keywords ?? []).filter(
        (keyword) =>
            !isPlaceName(keyword) &&
            keyword.toLowerCase() !== topicName.toLowerCase()
    )
}
