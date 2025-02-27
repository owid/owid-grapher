import { DataPageRelatedResearch, intersection } from "@ourworldindata/utils"

export function processRelatedResearch(
    candidates: DataPageRelatedResearch[],
    topicTags: string[]
) {
    let relatedResearch
    if (candidates.length > 3 && topicTags.length > 0) {
        relatedResearch = candidates.filter((research) => {
            const shared = intersection(research.tags, topicTags)
            return shared.length > 0
        })
    } else relatedResearch = [...candidates]

    return relatedResearch
}
