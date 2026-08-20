import { SearchChartHit } from "@ourworldindata/types"
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

/** Topic name → the vocabulary's search terms for that topic. */
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

const MAX_SUGGESTED_CHIPS = 5

// How far down a topic's vocabulary list to look for candidates.
//
// The vocabulary lists its terms roughly most- to least-central to the topic,
// and that ordering carries real judgment: the deeper terms drift towards the
// broad and obvious. Ranking the *whole* list by chart coverage below therefore
// hands the line straight back to the generic words this replaced, because
// "Men" and "Women" sit late in the Gender Ratio list but occur in far more of
// its charts than "Sex-selective abortion" does — at a cap of 20 that topic
// suggests "Men, Sex ratio, Missing women", and uncapped it opens with "Men,
// Women". Cutting the pool first keeps the two signals in their proper order:
// the vocabulary decides which terms are worth suggesting at all, coverage only
// decides between the ones that are. Measured over every topic, 12 leaves just
// two whose line opens on a word that generic, while still offering more than
// twice the candidates there are slots.
const MAX_VOCABULARY_CANDIDATES = 12

/**
 * Picks the all-charts block's "Suggested:" terms for a topic out of the
 * vocabulary's terms for it.
 *
 * The block used to derive these itself, by counting word frequencies across
 * the topic's chart titles and subtitles and offering the commonest words. That
 * reliably surfaced a topic's filler rather than its subject matter — Gender
 * Ratio suggested "women, sex, birth, men, female" — and, a frequency count
 * having no notion of a phrase or a word form, it would offer "births" and
 * "birth" side by side, or a word like "have" that the hand-written stop-word
 * list hadn't anticipated. The vocabulary is the same source material read by
 * something that understands it, so that topic now offers "Sex ratio, Missing
 * women, Sex discrimination, Sex-selective abortion" — multi-word terms among
 * them, which the old tokeniser could not represent at all.
 *
 * The vocabulary lists more candidates per topic than there are slots, so
 * `hits` decides which of the leading MAX_VOCABULARY_CANDIDATES make the line. A term that occurs in more of the
 * topic's charts describes more of the list the visitor is looking at, and is
 * likelier to lead somewhere: a chip runs a search, so one that matches nothing
 * is a dead end. Terms found in the charts' own text therefore come first,
 * most-matched first, and terms found nowhere in it fill whatever slots are
 * left rather than shortening the line — Algolia matches far more generously
 * than the substring test here does, so "found nowhere" means unproven, not
 * useless.
 *
 * Comes back empty while either the baseline chart list or the vocabulary is
 * still in flight (the caller then renders no "Suggested:" line at all) rather
 * than showing an unranked guess that would visibly reshuffle a moment later.
 */
export function rankSuggestedKeywords(
    vocabularyKeywords: string[],
    hits: SearchChartHit[],
    topicName: string
): string[] {
    if (hits.length === 0) return []

    const lowerCaseTopicName = topicName.toLowerCase()
    const keywords = vocabularyKeywords
        .slice(0, MAX_VOCABULARY_CANDIDATES)
        .filter(
            // A term the topic's own name already contains ("population" on
            // "Population Growth") narrows nothing down.
            (keyword) => !lowerCaseTopicName.includes(keyword.toLowerCase())
        )
    if (keywords.length === 0) return []

    const chartTexts = hits.map((hit) =>
        [hit.title, hit.subtitle].filter(Boolean).join(" ").toLowerCase()
    )

    const matched: { keyword: string; count: number }[] = []
    const unmatched: string[] = []
    for (const keyword of keywords) {
        const lowerCaseKeyword = keyword.toLowerCase()
        const count = chartTexts.filter((text) =>
            text.includes(lowerCaseKeyword)
        ).length
        if (count > 0) matched.push({ keyword, count })
        else unmatched.push(keyword)
    }

    // `sort` is stable, so terms matching the same number of charts keep the
    // order the vocabulary listed them in instead of being shuffled against
    // each other.
    matched.sort((a, b) => b.count - a.count)

    return [...matched.map(({ keyword }) => keyword), ...unmatched].slice(
        0,
        MAX_SUGGESTED_CHIPS
    )
}
