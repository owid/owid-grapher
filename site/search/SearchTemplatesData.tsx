import { match } from "ts-pattern"
import { SearchTopicType } from "./searchTypes.js"
import { DebugFigmaLink } from "./DebugFigmaLink.js"
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
            .with([SearchTopicType.Topic, true, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="399%3A25055" />
                </>
            ))
            // Data + Topic + Country + No Query
            .with([SearchTopicType.Topic, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="394%3A16183" />
                </>
            ))
            // Data + Topic + No Country + Query
            .with([SearchTopicType.Topic, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="397%3A19281" />
                </>
            ))
            // Data + Topic + No Country + No Query
            .with([SearchTopicType.Topic, false, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="112%3A6780" />
                </>
            ))
            // Data + Area + Country + Query
            .with([SearchTopicType.Area, true, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="399%3A23571" />
                </>
            ))
            // Data + Area + Country + No Query
            .with([SearchTopicType.Area, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A27755" />
                </>
            ))
            // Data + Area + No Country + Query
            .with([SearchTopicType.Area, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A29747" />
                </>
            ))
            // Data + Area + No Country + No Query
            .with([SearchTopicType.Area, false, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A15602" />
                </>
            ))
            // Data + No Topic + Country + Query
            .with([null, true, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="399%3A22146" />
                </>
            ))
            // Data + No Topic + Country + No Query
            .with([null, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="286%3A9579" />
                </>
            ))
            // Data + No Topic + No Country + Query
            .with([null, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="133%3A4452" />
                </>
            ))
            // Data + No Topic + No Country + No Query
            .with([null, false, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="211%3A5904" />
                </>
            ))
            .exhaustive()
    )
}
