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
                    <SearchDataResults isFirstChartLarge={true} />
                </>
            ))
            // Data + Topic + Country + No Query
            .with([SearchTopicType.Topic, true, false], () => (
                <>
                    <SearchDataResults isFirstChartLarge={false} />
                </>
            ))
            // Data + Topic + No Country + Query
            .with([SearchTopicType.Topic, false, true], () => (
                <>
                    <SearchDataResults isFirstChartLarge={true} />
                </>
            ))
            // Data + Topic + No Country + No Query
            .with([SearchTopicType.Topic, false, false], () => (
                <>
                    <SearchDataResults isFirstChartLarge={false} />
                </>
            ))
            // Data + Area + Country + Query
            .with([SearchTopicType.Area, true, true], () => (
                <>
                    <SearchDataResults isFirstChartLarge={true} />
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
                    <SearchDataResults isFirstChartLarge={true} />
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
                    <SearchDataResults isFirstChartLarge={true} />
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
                    <SearchDataResults isFirstChartLarge={true} />
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
