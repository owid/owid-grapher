import { match } from "ts-pattern"
import { useSearchContext } from "./SearchContext.js"
import { SearchTopicType } from "./searchTypes.js"

export const SearchTemplatesWriting = () => {
    const { templateConfig } = useSearchContext()

    return (
        match([
            templateConfig.topicType,
            templateConfig.hasCountry,
            templateConfig.hasQuery,
        ] as const)
            // Writing + Topic + Country + Query
            .with([SearchTopicType.Topic, true, true], () => <></>)
            // Writing + Topic + Country + No Query
            .with([SearchTopicType.Topic, true, false], () => <></>)
            // Writing + Topic + No Country + Query
            .with([SearchTopicType.Topic, false, true], () => <></>)
            // Writing + Topic + No Country + No Query
            .with([SearchTopicType.Topic, false, false], () => <></>)
            // Writing + Area + Country + Query
            .with([SearchTopicType.Area, true, true], () => <></>)
            // Writing + Area + Country + No Query
            .with([SearchTopicType.Area, true, false], () => <></>)
            // Writing + Area + No Country + Query
            .with([SearchTopicType.Area, false, true], () => <></>)
            // Writing + Area + No Country + No Query
            .with([SearchTopicType.Area, false, false], () => <></>)
            // Writing + No Topic + Country + Query
            .with([null, true, true], () => <></>)
            // Writing + No Topic + Country + No Query
            .with([null, true, false], () => <></>)
            // Writing + No Topic + No Country + Query
            .with([null, false, true], () => <></>)
            // Writing + No Topic + No Country + No Query
            .with([null, false, false], () => <></>)
            .exhaustive()
    )
}
