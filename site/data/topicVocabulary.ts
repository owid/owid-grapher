// Topic-keyword vocabulary used to populate the suggested-search pills on
// data pages (experiment exp-data-page-search-v1, treat2/treat3). Sourced
// from `functions/scripts/topic_vocabulary.json` at commit a3804c7f
// (subsequently removed from the repo).
import { sampleFrom } from "@ourworldindata/utils"
import vocabulary from "./topicVocabulary.json"

type TopicEntry = { topic_name: string; keywords: string[] }
const VOCABULARY = vocabulary as Record<string, TopicEntry>

/**
 * Collect keyword suggestions for a data page given its topic-tag names
 * (e.g. ["Child & Infant Mortality"]) and a name→slug map. Returns at most
 * `limit` distinct keywords. When `random` is true (default), the candidate
 * pool is sampled with a fresh seed so each call returns a different subset.
 */
export function getSuggestedKeywordsForTopics(
    topicTagNames: string[] | undefined,
    tagToSlugMap: Record<string, string>,
    limit = 6,
    random = true
): string[] {
    if (!topicTagNames?.length) return []
    const seen = new Set<string>()
    const candidates: string[] = []
    for (const name of topicTagNames) {
        const slug = tagToSlugMap[name]
        const entry = slug ? VOCABULARY[slug] : undefined
        if (!entry) continue
        for (const kw of entry.keywords) {
            const key = kw.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            candidates.push(kw)
        }
    }
    if (!random) return candidates.slice(0, limit)
    return sampleFrom(candidates, limit, Date.now())
}
