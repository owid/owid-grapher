import { match } from "ts-pattern"
import { SearchTopicType } from "./searchTypes.js"
import { useSearchContext } from "./SearchContext.js"
import { SearchDataResults } from "./SearchDataResults.js"
import { SearchDataTopicsResults } from "./SearchDataTopicsResults.js"

export const SearchTemplatesData = () => {
    const { templateConfig } = useSearchContext()

    return (
        match([
            templateConfig.topicType,
            templateConfig.hasCountry,
            templateConfig.hasQuery,
        ] as const)
            // Data + Topic + Country + Query
            .with([SearchTopicType.Topic, true, true], () => (
                <>
                    <SearchDataResults />
                </>
            ))
            // Data + Topic + Country + No Query
            .with([SearchTopicType.Topic, true, false], () => (
                <>
                    <SearchDataResults />
                </>
            ))
            // Data + Topic + No Country + Query
            .with([SearchTopicType.Topic, false, true], () => (
                <>
                    <SearchDataResults />
                </>
            ))
            // Data + Topic + No Country + No Query
            .with([SearchTopicType.Topic, false, false], () => (
                <>
                    <SearchDataResults />
                </>
            ))
            // Data + Area + Country + Query
            .with([SearchTopicType.Area, true, true], () => (
                <>
                    <SearchDataResults />
                </>
            ))
            // Data + Area + Country + No Query
            .with([SearchTopicType.Area, true, false], () => (
                <>
                    <SearchDataTopicsResults />
                </>
            ))
            // Data + Area + No Country + Query
            .with([SearchTopicType.Area, false, true], () => (
                <>
                    <SearchDataResults />
                </>
            ))
            // Data + Area + No Country + No Query
            .with([SearchTopicType.Area, false, false], () => (
                <>
                    <SearchDataTopicsResults />
                </>
            ))
            // Data + No Topic + Country + Query
            .with([null, true, true], () => (
                <>
                    <SearchDataResults />
                </>
            ))
            // Data + No Topic + Country + No Query
            .with([null, true, false], () => (
                <>
                    <SearchDataTopicsResults />
                </>
            ))
            // Data + No Topic + No Country + Query
            .with([null, false, true], () => (
                <>
                    <SearchDataResults />
                </>
            ))
            // Data + No Topic + No Country + No Query
            .with([null, false, false], () => (
                <>
                    <SearchDataTopicsResults />
                </>
            ))
            .exhaustive()
    )
}
