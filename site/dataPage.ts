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
    } else {
        relatedResearch = [...candidates]
    }
    for (const item of relatedResearch) {
        // TODO: these are workarounds to not link to the (not really existing) template pages for energy or co2
        // country profiles but instead to the topic page at the country selector.
        if (item.url === "/co2-country-profile")
            item.url =
                "/co2-and-greenhouse-gas-emissions#co2-and-greenhouse-gas-emissions-country-profiles"
        else if (item.url === "/energy-country-profile")
            item.url = "/energy#country-profiles"
        else if (item.url === "/coronavirus-country-profile")
            item.url = "/coronavirus#coronavirus-country-profiles"
    }
    return relatedResearch
}
