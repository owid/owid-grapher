import { match } from "ts-pattern"
import { SearchTopicType } from "./searchTypes.js"
import { useSearchContext } from "./SearchContext.js"

export const SearchTemplatesData = () => {
    const { templateConfig } = useSearchContext()

    return (
        match([
            templateConfig.topicType,
            templateConfig.hasCountry,
            templateConfig.hasQuery,
        ] as const)
            // Data + Topic + Country + Query
            .with([SearchTopicType.Topic, true, true], () => <></>)
            // Data + Topic + Country + No Query
            .with([SearchTopicType.Topic, true, false], () => <></>)
            // Data + Topic + No Country + Query
            .with([SearchTopicType.Topic, false, true], () => <></>)
            // Data + Topic + No Country + No Query
            .with([SearchTopicType.Topic, false, false], () => <></>)
            // Data + Area + Country + Query
            .with([SearchTopicType.Area, true, true], () => <></>)
            // Data + Area + Country + No Query
            .with([SearchTopicType.Area, true, false], () => <></>)
            // Data + Area + No Country + Query
            .with([SearchTopicType.Area, false, true], () => <></>)
            // Data + Area + No Country + No Query
            .with([SearchTopicType.Area, false, false], () => <></>)
            // Data + No Topic + Country + Query
            .with([null, true, true], () => <></>)
            // Data + No Topic + Country + No Query
            .with([null, true, false], () => <></>)
            // Data + No Topic + No Country + Query
            .with([null, false, true], () => <></>)
            // Data + No Topic + No Country + No Query
            .with([null, false, false], () => <></>)
            .exhaustive()
    )
}
