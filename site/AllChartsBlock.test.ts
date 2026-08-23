import { expect, it, describe } from "vitest"
import {
    indexTopicVocabularyByName,
    suggestedKeywords,
} from "./search/topicVocabulary.js"

describe(suggestedKeywords, () => {
    it("suggests the vocabulary's terms in the vocabulary's own order", () => {
        // Deliberately not re-ordered here: the generator picked this order by
        // measuring what each term reveals of this very chart list, weighted by
        // how much each chart is viewed. See suggestedKeywords.
        const keywords = ["sex ratio", "female population", "missing women"]
        expect(suggestedKeywords(keywords)).toEqual(keywords)
    })

    it("never suggests a place, however the vocabulary names it", () => {
        expect(
            suggestedKeywords([
                "United States",
                "UK",
                "Africa",
                "World",
                "school attendance",
            ])
        ).toEqual(["school attendance"])
    })

    it("suggests nothing for a topic the vocabulary doesn't cover", () => {
        expect(suggestedKeywords(undefined)).toEqual([])
        expect(suggestedKeywords([])).toEqual([])
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
            "Gender Ratio": ["Sex ratio", "Missing women"],
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
            "Gender Ratio": ["Sex ratio", "Missing women"],
            "Junk Keywords": ["Kept"],
        })
    })

    it("tolerates a response that isn't an object at all", () => {
        expect(indexTopicVocabularyByName(null)).toEqual({})
        expect(indexTopicVocabularyByName("nope")).toEqual({})
    })
})
