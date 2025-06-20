import { match } from "ts-pattern"
import { SearchTopicType } from "./searchTypes.js"
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
                    <SearchDataResults />
                    <SearchWritingResults />
                    <SearchDataInsightsResults />
                </>
            ))
            // All + Topic + Country + No Query
            .with([SearchTopicType.Topic, true, false], () => (
                <>
                    <SearchDataInsightsResults />
                    <SearchWritingResults />
                    <SearchDataResults />
                </>
            ))
            // All + Topic + No Country + Query
            .with([SearchTopicType.Topic, false, true], () => (
                <>
                    <SearchDataResults />
                    <SearchWritingResults />
                    <SearchDataInsightsResults />
                </>
            ))
            // All + Topic + No Country + No Query
            .with([SearchTopicType.Topic, false, false], () => (
                <>
                    <SearchWritingResults />
                    <SearchDataInsightsResults />
                    <SearchDataResults isFirstChartLarge={false} />
                </>
            ))
            // All + Area + Country + Query
            .with([SearchTopicType.Area, true, true], () => (
                <>
                    <SearchDataResults isFirstChartLarge={true} />
                    <SearchWritingResults />
                    <SearchDataInsightsResults />
                </>
            ))
            // All + Area + Country + No Query
            .with([SearchTopicType.Area, true, false], () => (
                <>
                    <SearchDataInsightsResults />
                    <SearchWritingResults />
                    <SearchDataTopicsResults />
                </>
            ))
            // All + Area + No Country + Query
            .with([SearchTopicType.Area, false, true], () => (
                <>
                    <SearchDataResults isFirstChartLarge={true} />
                    <SearchWritingResults />
                    <SearchDataInsightsResults />
                </>
            ))
            // All + Area + No Country + No Query
            .with([SearchTopicType.Area, false, false], () => (
                <>
                    <SearchWritingResults />
                    <SearchDataInsightsResults />
                    <SearchDataTopicsResults />
                </>
            ))
            // All + No Topic + Country + Query
            .with([null, true, true], () => (
                <>
                    <SearchDataResults isFirstChartLarge={true} />
                    <SearchWritingResults />
                    <SearchDataInsightsResults />
                </>
            ))
            // All + No Topic + Country + No Query
            .with([null, true, false], () => (
                <>
                    <SearchDataInsightsResults />
                    <SearchWritingResults />
                    <SearchDataTopicsResults />
                </>
            ))
            // All + No Topic + No Country + Query
            .with([null, false, true], () => (
                <>
                    <SearchDataResults isFirstChartLarge={true} />
                    <SearchWritingResults />
                    <SearchDataInsightsResults />
                </>
            ))
            // All + No Topic + No Country + No Query
            .with([null, false, false], () => null)
            .exhaustive()
    )
}
