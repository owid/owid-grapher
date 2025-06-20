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
                </>
            ))
            // All + Topic + Country + No Query
            .with([SearchTopicType.Topic, true, false], () => <></>)
            // All + Topic + No Country + Query
            .with([SearchTopicType.Topic, false, true], () => <></>)
            // All + Topic + No Country + No Query
            .with([SearchTopicType.Topic, false, false], () => (
                <>
                    <SearchWritingResults />
                    <SearchDataInsightsResults />
                    <SearchDataResults />
                </>
            ))
            // All + Area + Country + Query
            .with([SearchTopicType.Area, true, true], () => <></>)
            // All + Area + Country + No Query
            .with([SearchTopicType.Area, true, false], () => <></>)
            // All + Area + No Country + Query
            .with([SearchTopicType.Area, false, true], () => <></>)
            // All + Area + No Country + No Query
            .with([SearchTopicType.Area, false, false], () => <></>)
            // All + No Topic + Country + Query
            .with([null, true, true], () => <></>)
            // All + No Topic + Country + No Query
            .with([null, true, false], () => (
                <>
                    <SearchDataTopicsResults />
                </>
            ))
            // All + No Topic + No Country + Query
            .with([null, false, true], () => <></>)
            // All + No Topic + No Country + No Query
            .with([null, false, false], () => null)
            .exhaustive()
    )
}
