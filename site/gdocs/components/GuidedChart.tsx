import {
    EnrichedBlockChart,
    EnrichedBlockGuidedChart,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/types"
import { Container } from "./layout.js"
import { useRef, useCallback, useContext, useMemo } from "react"
import {
    GrapherState,
    Grapher,
    loadVariableDataAndMetadata,
} from "@ourworldindata/grapher"
import { traverseEnrichedBlock, guidedChartRegex } from "@ourworldindata/utils"
import ArticleBlock from "./ArticleBlock.js"
import { DocumentContext } from "../DocumentContext.js"
// import { useChartConfig } from "./ChartUtils.js"
import { DATA_API_URL } from "../../../settings/clientSettings.js"
import SpanElements from "./SpanElements.js"
import { ArticleBlocks } from "./ArticleBlocks.js"

function getChartBlock(
    content: OwidEnrichedGdocBlock[]
): EnrichedBlockChart | undefined {
    let chart: EnrichedBlockChart | undefined
    for (const block of content) {
        traverseEnrichedBlock(block, (node) => {
            if (node.type === "chart") {
                chart = node
            }
        })
    }
    return chart
}

export default function GuidedChart({
    d,
    className = "",
    containerType = "default",
}: {
    d: EnrichedBlockGuidedChart
    className?: string
    containerType?: Container
}) {
    const chartBlock = getChartBlock(d.content)
    console.log("chartBlock", chartBlock)
    return (
        <div className={className}>
            <ArticleBlocks blocks={d.content} containerType={containerType} />
        </div>
    )
}
