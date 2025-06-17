import { match } from "ts-pattern"
import { useSearchContext } from "./SearchContext.js"
import { SearchTopicType } from "./searchTypes.js"
import { DebugFigmaLink } from "./DebugFigmaLink.js"

export const SearchTemplatesWriting = () => {
    const { templateConfig } = useSearchContext()

    return (
        match([
            templateConfig.topicType,
            templateConfig.hasCountry,
            templateConfig.hasQuery,
        ] as const)
            // Writing + Topic + Country + Query
            .with([SearchTopicType.Topic, true, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="399%3A26366" />
                </>
            ))
            // Writing + Topic + Country + No Query
            .with([SearchTopicType.Topic, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="394%3A18807" />
                </>
            ))
            // Writing + Topic + No Country + Query
            .with([SearchTopicType.Topic, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="398%3A19929" />
                </>
            ))
            // Writing + Topic + No Country + No Query
            .with([SearchTopicType.Topic, false, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A22929" />
                </>
            ))
            // Writing + Area + Country + Query
            .with([SearchTopicType.Area, true, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="399%3A24237" />
                </>
            ))
            // Writing + Area + Country + No Query
            .with([SearchTopicType.Area, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A28660" />
                </>
            ))
            // Writing + Area + No Country + Query
            .with([SearchTopicType.Area, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A30293" />
                </>
            ))
            // Writing + Area + No Country + No Query
            .with([SearchTopicType.Area, false, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A17137" />
                </>
            ))
            // Writing + No Topic + Country + Query
            .with([null, true, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="399%3A22976" />
                </>
            ))
            // Writing + No Topic + Country + No Query
            .with([null, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A25682" />
                </>
            ))
            // Writing + No Topic + No Country + Query
            .with([null, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A26578" />
                </>
            ))
            // Writing + No Topic + No Country + No Query
            .with([null, false, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="113%3A7784" />
                </>
            ))
            .exhaustive()
    )
}
