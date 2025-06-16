import { match } from "ts-pattern"
import { SearchResultType, SearchTopicType } from "./searchTypes.js"
import { DebugFigmaLink } from "./DebugFigmaLink.js"
import { DataCatalogRibbonView } from "./DataCatalogRibbonView.js"
import { SearchDataInsights } from "./SearchDataInsightsSection.js"
import { useSearchContext } from "./SearchContext.js"

export const SearchTemplates = () => {
    const { templateConfig } = useSearchContext()

    return (
        match([
            templateConfig.resultType,
            templateConfig.topicType,
            templateConfig.hasCountry,
            templateConfig.hasQuery,
        ] as const)
            // All + Topic + Country + Query
            .with(
                [SearchResultType.ALL, SearchTopicType.Topic, true, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A21526" />
                    </>
                )
            )
            // Data + Area + Country + Query
            .with(
                [SearchResultType.DATA, SearchTopicType.Area, true, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="399%3A23571" />
                    </>
                )
            )
            // Data + Topic + Country + Query
            .with(
                [SearchResultType.DATA, SearchTopicType.Topic, true, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="399%3A25055" />
                    </>
                )
            )
            // All + Area + Country + Query
            .with(
                [SearchResultType.ALL, SearchTopicType.Area, true, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A19676" />
                        <DataCatalogRibbonView />
                        <SearchDataInsights />
                    </>
                )
            )
            // Writing + Area + Country + Query
            .with(
                [SearchResultType.WRITING, SearchTopicType.Area, true, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="399%3A24237" />
                    </>
                )
            )
            // Writing + Topic + Country + Query
            .with(
                [SearchResultType.WRITING, SearchTopicType.Topic, true, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="399%3A26366" />
                    </>
                )
            )
            // All + Topic + Country + No Query
            .with(
                [SearchResultType.ALL, SearchTopicType.Topic, true, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="297%3A8229" />
                    </>
                )
            )
            // All + Topic + No Country + Query
            .with(
                [SearchResultType.ALL, SearchTopicType.Topic, false, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="298%3A11950" />
                    </>
                )
            )
            // Writing + Area + Country + No Query
            .with(
                [SearchResultType.WRITING, SearchTopicType.Area, true, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A28660" />
                    </>
                )
            )
            // Data + Topic + No Country + Query
            .with(
                [SearchResultType.DATA, SearchTopicType.Topic, false, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="397%3A19281" />
                    </>
                )
            )
            // Data + Topic + Country + No Query
            .with(
                [SearchResultType.DATA, SearchTopicType.Topic, true, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="394%3A16183" />
                    </>
                )
            )
            // All + Area + Country + No Query
            .with(
                [SearchResultType.ALL, SearchTopicType.Area, true, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A27071" />
                    </>
                )
            )
            // Data + Area + No Country + Query
            .with(
                [SearchResultType.DATA, SearchTopicType.Area, false, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A29747" />
                    </>
                )
            )
            // Data + Area + Country + No Query
            .with(
                [SearchResultType.DATA, SearchTopicType.Area, true, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A27755" />
                    </>
                )
            )
            // Writing + Area + No Country + Query
            .with(
                [SearchResultType.WRITING, SearchTopicType.Area, false, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A30293" />
                    </>
                )
            )
            // Writing + No Topic + Country + Query
            .with([SearchResultType.WRITING, null, true, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="399%3A22976" />
                </>
            ))
            // Data + No Topic + Country + Query
            .with([SearchResultType.DATA, null, true, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="399%3A22146" />
                </>
            ))
            // Writing + Topic + Country + No Query
            .with(
                [SearchResultType.WRITING, SearchTopicType.Topic, true, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="394%3A18807" />
                    </>
                )
            )
            // All + Area + No Country + Query
            .with(
                [SearchResultType.ALL, SearchTopicType.Area, false, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A22059" />
                    </>
                )
            )
            // All + No Topic + Country + Query
            .with([SearchResultType.ALL, null, true, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="298%3A11224" />
                </>
            ))
            // Writing + Topic + No Country + Query
            .with(
                [SearchResultType.WRITING, SearchTopicType.Topic, false, true],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="398%3A19929" />
                    </>
                )
            )
            // All + Topic + No Country + No Query
            .with(
                [SearchResultType.ALL, SearchTopicType.Topic, false, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A24427" />
                    </>
                )
            )
            // Writing + Area + No Country + No Query
            .with(
                [SearchResultType.WRITING, SearchTopicType.Area, false, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A17137" />
                    </>
                )
            )
            // Data + Area + No Country + No Query
            .with(
                [SearchResultType.DATA, SearchTopicType.Area, false, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A15602" />
                    </>
                )
            )
            // All + Area + No Country + No Query
            .with(
                [SearchResultType.ALL, SearchTopicType.Area, false, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="113%3A8747" />
                    </>
                )
            )
            // All + No Topic + Country + No Query
            .with([SearchResultType.ALL, null, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A25073" />
                </>
            ))
            // All + No Topic + No Country + Query
            .with([SearchResultType.ALL, null, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="130%3A5909" />
                </>
            ))
            // Data + Topic + No Country + No Query
            .with(
                [SearchResultType.DATA, SearchTopicType.Topic, false, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="112%3A6780" />
                    </>
                )
            )
            // Writing + No Topic + No Country + Query
            .with([SearchResultType.WRITING, null, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A26578" />
                </>
            ))
            // Writing + Topic + No Country + No Query
            .with(
                [SearchResultType.WRITING, SearchTopicType.Topic, false, false],
                () => (
                    <>
                        <DebugFigmaLink figmaNodeId="302%3A22929" />
                    </>
                )
            )
            // Data + No Topic + No Country + Query
            .with([SearchResultType.DATA, null, false, true], () => (
                <>
                    <DebugFigmaLink figmaNodeId="133%3A4452" />
                </>
            ))
            // Data + No Topic + Country + No Query
            .with([SearchResultType.DATA, null, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="286%3A9579" />
                </>
            ))
            // Writing + No Topic + Country + No Query
            .with([SearchResultType.WRITING, null, true, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="302%3A25682" />
                </>
            ))
            // All + No Topic + No Country + No Query
            .with([SearchResultType.ALL, null, false, false], () => null)
            // Data + No Topic + No Country + No Query
            .with([SearchResultType.DATA, null, false, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="211%3A5904" />
                </>
            ))
            // Writing + No Topic + No Country + No Query
            .with([SearchResultType.WRITING, null, false, false], () => (
                <>
                    <DebugFigmaLink figmaNodeId="113%3A7784" />
                </>
            ))
            .exhaustive()
    )
}
