import { expect, it, describe } from "vitest"
import { SearchChartHit } from "@ourworldindata/types"
import {
    indexTopicVocabularyByName,
    rankSuggestedKeywords,
    type TopicVocabularyEntry,
} from "./search/topicVocabulary.js"

const makeHits = (...texts: string[]): SearchChartHit[] =>
    texts.map((title) => ({ title }) as SearchChartHit)

// A vocabulary entry the generator did not check against the search API, so the
// ranking has to work its own coverage out. See `refined` entries at the bottom.
const unrefined = (...keywords: string[]): TopicVocabularyEntry => ({
    keywords,
    refined: false,
})

describe(rankSuggestedKeywords, () => {
    const hits = makeHits(
        "Share of women in parliament",
        "Women in managerial positions",
        "Sex ratio at birth"
    )

    it("puts the terms describing more of the topic's charts first", () => {
        expect(
            rankSuggestedKeywords(
                unrefined("Sex ratio", "Women"),
                hits,
                "Gender Ratio"
            )
        ).toEqual(["Women", "Sex ratio"])
    })

    it("keeps the vocabulary's order between terms describing equally many charts", () => {
        expect(
            rankSuggestedKeywords(
                unrefined("Sex ratio", "Parliament"),
                hits,
                "Gender Ratio"
            )
        ).toEqual(["Sex ratio", "Parliament"])
    })

    it("fills the remaining slots with terms it couldn't match rather than shortening the line", () => {
        // "Missing women" matches no chart above, but Algolia matches more
        // generously than the substring test does, so it is offered last
        // instead of dropped.
        expect(
            rankSuggestedKeywords(
                unrefined("Missing women", "Sex ratio"),
                hits,
                "Gender Ratio"
            )
        ).toEqual(["Sex ratio", "Missing women"])
    })

    it("offers at most five terms", () => {
        const keywords = [
            "Women",
            "Sex ratio",
            "Parliament",
            "Managerial positions",
            "Birth",
            "Missing women",
            "Infanticide",
        ]
        expect(
            rankSuggestedKeywords(unrefined(...keywords), hits, "Gender Ratio")
        ).toHaveLength(5)
    })

    it("ignores candidates past the head of the vocabulary list, so a broad term deep in it can't outrank a specific one", () => {
        // The real failure this guards: "Men"/"Women" sit late in the Gender
        // Ratio vocabulary but occur in more of its charts than any specific
        // term, so an uncapped pool opens the line with them.
        const specific = "Sex-selective abortion"
        const broad = "Women"
        const keywords = [
            specific,
            ...Array.from({ length: 12 }, (_, i) => `Filler ${i}`),
            broad,
        ]
        const skewedHits = makeHits(
            "Women in parliament",
            "Women in work",
            "Sex-selective abortion by birth order"
        )
        expect(
            rankSuggestedKeywords(
                unrefined(...keywords),
                skewedHits,
                "Gender Ratio"
            )
        ).not.toContain(broad)
    })

    it("drops a term that only reaches charts an earlier term already reached", () => {
        // The real failure: Gender Ratio offered "missing women",
        // "sex-selective abortion" and "excess female mortality" — three chips,
        // the same two charts.
        const hits = makeHits(
            "Number of 'missing women' in the world",
            "Annual number of missing female births and excess mortality",
            "Representation of women in the judiciary"
        )
        expect(
            rankSuggestedKeywords(
                unrefined("missing", "excess mortality", "judiciary"),
                hits,
                "Gender Ratio"
            )
        ).toEqual(["missing", "judiciary", "excess mortality"])
    })

    it("prefers an unproven term over a known duplicate when filling the line", () => {
        const hits = makeHits("Sex ratio at birth", "Sex ratio by age")
        // "sex ratio" covers both charts, so "at birth" is a duplicate;
        // "infanticide" matches nothing here but Algolia may still find it.
        expect(
            rankSuggestedKeywords(
                unrefined("sex ratio", "sex ratio at birth", "infanticide"),
                hits,
                "Gender Ratio"
            )
        ).toEqual(["sex ratio", "infanticide", "sex ratio at birth"])
    })

    it("never suggests a place, however the vocabulary names it", () => {
        const hits = makeHits(
            "Child labor in the United States",
            "Child labor in the UK",
            "School attendance"
        )
        expect(
            rankSuggestedKeywords(
                unrefined(
                    "United States",
                    "UK",
                    "Africa",
                    "World",
                    "school attendance"
                ),
                hits,
                "Child Labor"
            )
        ).toEqual(["school attendance"])
    })

    it("drops terms the topic's own name already contains", () => {
        expect(
            rankSuggestedKeywords(
                unrefined("Gender", "ratio", "Sex ratio"),
                hits,
                "Gender Ratio"
            )
        ).toEqual(["Sex ratio"])
    })

    it("matches case-insensitively", () => {
        expect(
            rankSuggestedKeywords(unrefined("SEX RATIO"), hits, "Gender Ratio")
        ).toEqual(["SEX RATIO"])
    })

    it("suggests nothing before the topic's charts have loaded", () => {
        expect(
            rankSuggestedKeywords(unrefined("Sex ratio"), [], "Gender Ratio")
        ).toEqual([])
    })

    it("suggests nothing for a topic the vocabulary doesn't cover", () => {
        expect(
            rankSuggestedKeywords(unrefined(), hits, "Gender Ratio")
        ).toEqual([])
    })
    it("takes a refined vocabulary's order as given, since its generator checked it against real search results", () => {
        // "sex ratio at birth" looks like a narrower spelling of "sex ratio"
        // and matches a subset of the same charts, so the unrefined path
        // demotes it — but a refined list has already been checked against
        // what each term actually returns, so it stays put.
        const keywords = ["sex ratio", "sex ratio at birth", "missing women"]
        const hits = makeHits(
            "Sex ratio at birth",
            "Sex ratio by age",
            "Number of 'missing women' in the world"
        )
        expect(
            rankSuggestedKeywords(
                { keywords, refined: true },
                hits,
                "Gender Ratio"
            )
        ).toEqual(keywords)
        expect(
            rankSuggestedKeywords(unrefined(...keywords), hits, "Gender Ratio")
        ).toEqual(["sex ratio", "missing women", "sex ratio at birth"])
    })

    it("offers a refined vocabulary's terms before the chart list has arrived", () => {
        // Nothing about a refined order depends on the charts, so the line
        // doesn't have to wait for them.
        expect(
            rankSuggestedKeywords(
                { keywords: ["sex ratio", "missing women"], refined: true },
                [],
                "Gender Ratio"
            )
        ).toEqual(["sex ratio", "missing women"])
    })

    it("still refuses to suggest a place from a refined vocabulary", () => {
        expect(
            rankSuggestedKeywords(
                {
                    keywords: ["United States", "school attendance"],
                    refined: true,
                },
                [],
                "Child Labor"
            )
        ).toEqual(["school attendance"])
    })

    it("suggests nothing when the vocabulary has no entry for the topic", () => {
        expect(
            rankSuggestedKeywords(
                undefined,
                makeHits("Sex ratio"),
                "Gender Ratio"
            )
        ).toEqual([])
    })
})

describe(indexTopicVocabularyByName, () => {
    const published = {
        "gender-ratio": {
            topic_name: "Gender Ratio",
            keywords: ["Sex ratio", "Missing women"],
            stats: { num_keywords: 2 },
        },
    }

    it("re-keys the published vocabulary by topic name", () => {
        expect(indexTopicVocabularyByName(published)).toEqual({
            "Gender Ratio": {
                keywords: ["Sex ratio", "Missing women"],
                refined: false,
            },
        })
    })

    it("skips entries a regeneration could have left malformed", () => {
        expect(
            indexTopicVocabularyByName({
                ...published,
                "no-name": { keywords: ["Orphaned"] },
                "no-keywords": { topic_name: "No Keywords" },
                "wrong-type": { topic_name: "Wrong Type", keywords: "nope" },
                "junk-keywords": {
                    topic_name: "Junk Keywords",
                    keywords: ["Kept", "", null, 7],
                },
                nothing: null,
            })
        ).toEqual({
            "Gender Ratio": {
                keywords: ["Sex ratio", "Missing women"],
                refined: false,
            },
            "Junk Keywords": { keywords: ["Kept"], refined: false },
        })
    })

    it("reads whether the generator refined the entry against real search results", () => {
        const refined = indexTopicVocabularyByName({
            "gender-ratio": {
                topic_name: "Gender Ratio",
                keywords: ["Sex ratio"],
                stats: { refined: true },
            },
        })
        expect(refined["Gender Ratio"].refined).toBe(true)
    })

    it("tolerates a response that isn't an object at all", () => {
        expect(indexTopicVocabularyByName(null)).toEqual({})
        expect(indexTopicVocabularyByName("nope")).toEqual({})
    })
})
