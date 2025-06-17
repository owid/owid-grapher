import { match } from "ts-pattern"
import { SearchTopicType } from "./searchTypes.js"
import { DebugFigmaLink } from "./DebugFigmaLink.js"
import { DataCatalogRibbonView } from "./DataCatalogRibbonView.js"
import { DataCatalogResults } from "./DataCatalogResults.js"
import { useSearchContext } from "./SearchContext.js"

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
                    <DebugFigmaLink figmaNodeId="302%3A21526" />
                    <DataCatalogResults />
                </>
            ))
            // All + Topic + Country + No Query
            .with([SearchTopicType.Topic, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="297%3A8229" />
                </>
            ))
            // All + Topic + No Country + Query
            .with([SearchTopicType.Topic, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="298%3A11950" />
                </>
            ))
            // All + Topic + No Country + No Query
            .with([SearchTopicType.Topic, false, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A24427" />
                </>
            ))
            // All + Area + Country + Query
            .with([SearchTopicType.Area, true, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A19676" />
                </>
            ))
            // All + Area + Country + No Query
            .with([SearchTopicType.Area, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A27071" />
                </>
            ))
            // All + Area + No Country + Query
            .with([SearchTopicType.Area, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A22059" />
                </>
            ))
            // All + Area + No Country + No Query
            .with([SearchTopicType.Area, false, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="113%3A8747" />
                </>
            ))
            // All + No Topic + Country + Query
            .with([null, true, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="298%3A11224" />
                </>
            ))
            // All + No Topic + Country + No Query
            .with([null, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A25073" />
                    <DataCatalogRibbonView />
                </>
            ))
            // All + No Topic + No Country + Query
            .with([null, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="130%3A5909" />
                </>
            ))
            // All + No Topic + No Country + No Query
            .with([null, false, false], () => null)
            .exhaustive()
    )
}
