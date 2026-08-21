import { SearchChartHit } from "@ourworldindata/types"
import { getRegionByNameOrVariantName } from "@ourworldindata/utils"
import {
    DEFAULT_TOPIC_VOCABULARY_URL,
    TOPIC_VOCABULARY_URL,
} from "../../settings/clientSettings.js"
import { filterChartHitsByQueryWords } from "./searchUtils.js"

// The vocabulary as published: keyed by topic slug, each entry carrying the
// topic's name, its keywords, and generation stats we have no use for here.
interface PublishedTopicVocabularyEntry {
    topic_name?: string
    keywords?: string[]
    stats?: { refined?: boolean }
}

export interface TopicVocabularyEntry {
    keywords: string[]
    /**
     * Whether the generator checked each term against the site's search and
     * re-picked the list from what came back, rather than proposing it from
     * chart text alone. When it did, its ordering is better informed than
     * anything this file can work out — see rankSuggestedKeywords.
     */
    refined: boolean
}

/** Topic name → the vocabulary's entry for that topic. */
export type TopicVocabulary = Record<string, TopicVocabularyEntry>

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
    for (const entry_ of Object.values(data)) {
        const { topic_name: topicName, keywords } =
            (entry_ as PublishedTopicVocabularyEntry) ?? {}
        if (typeof topicName !== "string" || !topicName) continue
        if (!Array.isArray(keywords)) continue
        const entry = entry_ as PublishedTopicVocabularyEntry
        vocabulary[topicName] = {
            keywords: keywords.filter(
                (keyword): keyword is string =>
                    typeof keyword === "string" && keyword.length > 0
            ),
            refined: entry.stats?.refined === true,
        }
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
// broad and obvious. Ranking the *whole* list therefore risks handing the line
// back to the generic words this replaced — "Men" and "Women" sit near the end
// of the published vocabulary's Gender Ratio list but occur in more of its
// charts than any specific term, so uncapped that topic opens with "Women, Men"
// instead of "Sex ratio, Missing women". Removing the cap moves 78 of the 125
// topics' lines and 23 of their opening terms, in that direction. Cutting the
// pool first keeps the two signals in their proper order: the vocabulary decides
// which terms are worth suggesting at all, the charts decide between the ones
// that are.
const MAX_VOCABULARY_CANDIDATES = 12

// True for anything that names a place: a country, a continent, an aggregate
// like "World", or a variant name for one of those ("US", "UK"). Suggested
// searches deliberately don't include places — they offer ways of narrowing
// *what* the charts are about, and a country derived from the whole topic just
// sits there while the visitor searches for a different one. Searching by
// country still works, it just isn't suggested. This is the same lookup the
// rest of the site uses to recognise one, so variants and non-country regions
// are covered without a hand-written list of names.
//
// The vocabulary is asked not to name places, but it is regenerated out of band
// by a script in another repo, and successive generations have drifted in and
// out of offering "United States" or "Ukraine" as a keyword. Enforcing it here
// keeps that drift out of the page.
function isPlaceName(name: string): boolean {
    return getRegionByNameOrVariantName(name) !== undefined
}

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
 * list hadn't anticipated.
 *
 * The vocabulary offers more candidates than the line has slots, so the topic's
 * own chart list picks between them, on two counts:
 *
 * - **Reach.** A chip runs a search, and the block narrows those results to the
 *   rows whose own visible text contains the query, so a term no row on the page
 *   matches empties the list. Reach is therefore measured with that same filter
 *   (filterChartHitsByQueryWords), a term reaching more rows is offered first,
 *   and a term reaching none is not offered at all.
 * - **Distinctness.** A term is only kept while it reaches a chart the terms
 *   before it didn't. Without this the line spends its slots several times over
 *   on the same destination — Gender Ratio offered "missing women",
 *   "sex-selective abortion" and "excess female mortality", three chips leading
 *   to the same two charts, so five suggestions were really two. Near-synonyms
 *   are hard to spot as text but obvious in what they match, which is why this
 *   is decided here rather than asked of whoever generates the vocabulary.
 *
 * A term held back as a duplicate still fills a leftover slot, since it does
 * lead somewhere; a term that reaches nothing cannot. Measured against the
 * production vocabulary and the live index, 25 of the 620 terms it has been
 * showing (4%) run a search that renders an empty list, and dropping them
 * shortens only 3 topics' lines and empties none.
 *
 * None of this applies to a vocabulary the generator has already refined
 * against the search API: its ordering is better informed than anything
 * measurable here, so it is taken as given. See the note in the body.
 *
 * Comes back empty until the vocabulary arrives, and — for an unrefined
 * vocabulary only — until the baseline chart list does too, rather than showing
 * an unranked guess that would visibly reshuffle a moment later.
 */
export function rankSuggestedKeywords(
    entry: TopicVocabularyEntry | undefined,
    hits: SearchChartHit[]
): string[] {
    // Only places are refused outright. A term the topic's own name contains was
    // refused too, on the reasoning that a reader already on the page has
    // applied it — which is true for most topics and badly wrong for a minority
    // whose charts are simply called after the topic. Measured over all 125
    // topics, allowing it changes the median topic's reach by 0.3% and
    // transforms thirty of them: Religion goes from covering 39% of its topic's
    // traffic to 97%, Life Expectancy from 21% to 98%, because half of that
    // topic is one chart titled "Life expectancy" and nothing narrower reaches
    // it. The generator applies the same rule, and its report shows what each
    // term reaches, so an over-broad first term is visible rather than guessed
    // at.
    //
    // Filtering before the candidate cap below, so a refused term doesn't eat a
    // candidate slot. It widens the window a little where a place does sit in
    // the vocabulary's head, but that is rare (6 terms across 3 topics of 125)
    // and the one topic whose line it changes is better for it: Poverty ends on
    // "relative poverty" rather than "nutrition".
    const offerable = (entry?.keywords ?? []).filter(
        (keyword) => !isPlaceName(keyword)
    )
    if (offerable.length === 0) return []

    // A refined vocabulary has already been through this exercise with better
    // evidence: its generator asked the search API what each term actually
    // returns, weighted the results by how much each chart is viewed, and
    // re-picked the list from the answers. Second-guessing that from the
    // topic's default list — unweighted, and blind to everything the search
    // would have found — makes the line worse: re-ranking one refined
    // vocabulary rewrote 100 of 125 topics and 54 of their opening terms, while
    // not one of its 541 published terms rendered an empty list.
    //
    // It also means the line stops waiting on the chart list, since nothing
    // about the order depends on it any more.
    if (entry?.refined) return offerable.slice(0, MAX_SUGGESTED_CHIPS)

    if (hits.length === 0) return []
    const candidates = offerable.slice(0, MAX_VOCABULARY_CANDIDATES)

    // The rows each term would leave standing, by the block's own filter, so a
    // term ranked here reaches exactly what clicking it renders. Terms reaching
    // nothing are dropped rather than offered as a dead end.
    const matched = candidates
        .map((keyword) => ({
            keyword,
            charts: new Set(filterChartHitsByQueryWords(hits, keyword)),
        }))
        .filter(({ charts }) => charts.size > 0)

    // `sort` is stable, so terms reaching the same number of charts keep the
    // order the vocabulary listed them in instead of being shuffled against
    // each other.
    matched.sort((a, b) => b.charts.size - a.charts.size)

    const covered = new Set<SearchChartHit>()
    const distinct: string[] = []
    const duplicates: string[] = []
    for (const { keyword, charts } of matched) {
        const reachesSomethingNew = [...charts].some(
            (chart) => !covered.has(chart)
        )
        if (!reachesSomethingNew) {
            duplicates.push(keyword)
            continue
        }
        distinct.push(keyword)
        for (const chart of charts) covered.add(chart)
    }

    return [...distinct, ...duplicates].slice(0, MAX_SUGGESTED_CHIPS)
}
