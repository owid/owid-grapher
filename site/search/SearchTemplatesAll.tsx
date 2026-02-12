import { match } from "ts-pattern"
import { SearchTopicType } from "@ourworldindata/types"
import { SearchDataTopicsResults } from "./SearchDataTopicsResults.js"
import { SearchDataResults } from "./SearchDataResults.js"
import { useSearchContext } from "./SearchContext.js"
import { SearchWritingResults } from "./SearchWritingResults.js"
import { SearchDataInsightsResults } from "./SearchDataInsightsResults.js"

export const SearchTemplatesAll = () => {
    const { templateConfig } = useSearchContext()

    return (
        match([
            templateConfig.topicType,
            templateConfig.hasCountry,
            templateConfig.hasQuery,
        ] as const)
            // All + Topic + Country + Query
            .with([SearchTopicType.Topic, true, true], () => (
                <>
                    <SearchDataInsightsResults />
                    <SearchDataResults isFirstChartLarge={true} />
                    <SearchWritingResults showProfiles={true} />
                </>
            ))
            // All + Topic + Country + No Query
            .with([SearchTopicType.Topic, true, false], () => (
                <>
                    <SearchDataInsightsResults />
                    <SearchDataResults isFirstChartLarge={false} />
                    <SearchWritingResults />
                </>
            ))
            // All + Topic + No Country + Query
            .with([SearchTopicType.Topic, false, true], () => (
                <>
                    <SearchWritingResults />
                    <SearchDataResults isFirstChartLarge={true} />
                    <SearchDataInsightsResults />
                </>
            ))
            // All + Topic + No Country + No Query
            .with([SearchTopicType.Topic, false, false], () => (
                <>
                    <SearchWritingResults />
                    <SearchDataResults isFirstChartLarge={false} />
                    <SearchDataInsightsResults />
                </>
            ))
            // All + Area + Country + Query
            .with([SearchTopicType.Area, true, true], () => (
                <>
                    <SearchDataInsightsResults />
                    <SearchDataResults isFirstChartLarge={true} />
                    <SearchWritingResults />
                </>
            ))
            // All + Area + Country + No Query
            .with([SearchTopicType.Area, true, false], () => (
                <>
                    <SearchDataInsightsResults />
                    <SearchDataTopicsResults />
                    <SearchWritingResults />
                </>
            ))
            // All + Area + No Country + Query
            .with([SearchTopicType.Area, false, true], () => (
                <>
                    <SearchWritingResults />
                    <SearchDataResults isFirstChartLarge={true} />
                    <SearchDataInsightsResults />
                </>
            ))
            // All + Area + No Country + No Query
            .with([SearchTopicType.Area, false, false], () => (
                <>
                    <SearchWritingResults />
                    <SearchDataTopicsResults />
                    <SearchDataInsightsResults />
                </>
            ))
            // All + No Topic + Country + Query
            .with([null, true, true], () => (
                <>
                    <SearchDataInsightsResults />
                    <SearchDataResults isFirstChartLarge={true} />
                    <SearchWritingResults showProfiles={true} />
                </>
            ))
            // All + No Topic + Country + No Query
            .with([null, true, false], () => (
                <>
                    <SearchDataInsightsResults />
                    <SearchDataTopicsResults />
                    <SearchWritingResults hasTopicPages={false} showProfiles={true} />
                </>
            ))
            // All + No Topic + No Country + Query
            .with([null, false, true], () => (
                <>
                    <SearchWritingResults />
                    <SearchDataResults isFirstChartLarge={true} />
                    <SearchDataInsightsResults />
                </>
            ))
            // All + No Topic + No Country + No Query
            .with([null, false, false], () => null)
            .exhaustive()
    )
}
