import { match, P } from "ts-pattern"
import { SearchTopicType } from "@ourworldindata/types"
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
            templateConfig.hasDatasetFilters,
        ] as const)
            // Dataset filters override all other template logic: always show
            // flat data results regardless of topic/country/query combination.
            .with([P._, P._, P._, true], () => (
                <SearchDataResults isFirstChartLarge={false} />
            ))
            // Data + Topic + Country + Query
            .with([SearchTopicType.Topic, true, true, false], () => (
                <SearchDataResults isFirstChartLarge={true} />
            ))
            // Data + Topic + Country + No Query
            .with([SearchTopicType.Topic, true, false, false], () => (
                <SearchDataResults isFirstChartLarge={false} />
            ))
            // Data + Topic + No Country + Query
            .with([SearchTopicType.Topic, false, true, false], () => (
                <SearchDataResults isFirstChartLarge={true} />
            ))
            // Data + Topic + No Country + No Query
            .with([SearchTopicType.Topic, false, false, false], () => (
                <SearchDataResults isFirstChartLarge={false} />
            ))
            // Data + Area + Country + Query
            .with([SearchTopicType.Area, true, true, false], () => (
                <SearchDataResults isFirstChartLarge={true} />
            ))
            // Data + Area + Country + No Query
            .with([SearchTopicType.Area, true, false, false], () => (
                <SearchDataTopicsResults />
            ))
            // Data + Area + No Country + Query
            .with([SearchTopicType.Area, false, true, false], () => (
                <SearchDataResults isFirstChartLarge={true} />
            ))
            // Data + Area + No Country + No Query
            .with([SearchTopicType.Area, false, false, false], () => (
                <SearchDataTopicsResults />
            ))
            // Data + No Topic + Country + Query
            .with([null, true, true, false], () => (
                <SearchDataResults isFirstChartLarge={true} />
            ))
            // Data + No Topic + Country + No Query
            .with([null, true, false, false], () => <SearchDataTopicsResults />)
            // Data + No Topic + No Country + Query
            .with([null, false, true, false], () => (
                <SearchDataResults isFirstChartLarge={true} />
            ))
            // Data + No Topic + No Country + No Query
            .with([null, false, false, false], () => (
                <SearchDataTopicsResults />
            ))
            .exhaustive()
    )
}
