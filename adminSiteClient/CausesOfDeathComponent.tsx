import { EntityName, Time } from "@ourworldindata/types"
import {
    CAUSE_OF_DEATH_CATEGORIES,
    DataRow,
    EnrichedDataItem,
    TreeNode,
} from "./CausesOfDeathConstants"
import { useMemo } from "react"
import * as d3 from "d3"
import useChartDimensions, { DimensionsConfig } from "./useChartDimensions"
import { CausesOfDeathCategoryAnnotations } from "./CausesOfDeathCategoryAnnotations"

import { MyCausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import { CausesOfDeathTreemapTile } from "./CausesOfDeathTreemapTile.js"

export { CausesOfDeathCaptionedChart } from "./CausesOfDeathCaptionedChart"

const SMALL_BREAKPOINT = 768

export function ResponsiveCausesOfDeathTreemap({
    data,
    metadata,
    entityName,
    year,
    dimensionsConfig,
    tilingMethod,
    debug = false,
}: {
    data: DataRow[]
    metadata: MyCausesOfDeathMetadata
    entityName: EntityName
    year: Time
    dimensionsConfig?: DimensionsConfig
    tilingMethod?: any // TODO
    debug?: boolean
}) {
    const { ref, dimensions } = useChartDimensions<HTMLDivElement>({
        config: dimensionsConfig,
    })

    // TODO: extract
    const isNarrow = dimensions.width < SMALL_BREAKPOINT
    const myTilingMethod = isNarrow
        ? d3.treemapSlice
        : (tilingMethod ?? d3.treemapSquarify)

    const height = isNarrow
        ? (dimensionsConfig?.maxHeight ?? 900)
        : dimensions.height

    return (
        <div ref={ref}>
            <CausesOfDeathTreemap
                data={data}
                metadata={metadata}
                entityName={entityName}
                year={year}
                tilingMethod={myTilingMethod}
                width={dimensions.width}
                height={height}
                debug={debug}
            />
        </div>
    )
}

function CausesOfDeathTreemap({
    data,
    metadata,
    entityName,
    year,
    tilingMethod = d3.treemapSquarify,
    width,
    height,
    debug = false,
}: {
    data: DataRow[]
    metadata: MyCausesOfDeathMetadata
    entityName: EntityName
    year: Time
    width: number
    height: number
    tilingMethod?: any // TODO: type this
    debug?: boolean
}) {
    console.log("metad", metadata)

    const enrichedData: EnrichedDataItem[] = [
        // Root node
        { entityName, year, variable: "All", value: null },
        // Category nodes
        ...CAUSE_OF_DEATH_CATEGORIES.map((category) => ({
            entityName,
            year,
            variable: category,
            parentId: "All", // points to the root node
            value: null,
        })),
        // Data nodes
        ...data.map((row) => {
            const category = metadata.categoryNameByVariableName.get(
                row.variable
            )
            return { ...row, category, parentId: category }
        }),
    ]

    const stratify = d3
        .stratify<EnrichedDataItem>()
        .id((d) => d.variable)
        .parentId((d) => d.parentId)

    const treeData = stratify(enrichedData)

    const hierarchy = d3
        .hierarchy(treeData)
        .sum((d) => d.data.value || 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0))

    const treemapLayout = d3
        .treemap<d3.HierarchyNode<EnrichedDataItem>>()
        .tile(tilingMethod)
        .size([width, height])
        .padding(1)
        .round(true)

    const root = treemapLayout(hierarchy)
    const leaves = useMemo(() => root.leaves() as TreeNode[], [root])

    const numAllDeaths = d3.sum(data, (d) => d.value) || 0

    // TODO: extract?
    const isNarrow = width < SMALL_BREAKPOINT
    const annotationHeight = !isNarrow ? 30 : 0

    return (
        <svg
            className="causes-of-death-treemap"
            // TODO: figure out the height stuff
            viewBox={`0 0 ${width} ${height + annotationHeight}`}
            width={width}
            height={height + annotationHeight}
        >
            {leaves.map((node) => (
                <CausesOfDeathTreemapTile
                    key={node.data.id}
                    node={node}
                    description={
                        metadata.variableByName.get(node.data.data.variable)
                            ?.description || ""
                    }
                    // todo: remove this somehow
                    numAllDeaths={numAllDeaths}
                    isLargestTile={leaves[0] === node}
                    annotationHeight={annotationHeight}
                    isNarrow={isNarrow}
                    treemapWidth={width}
                    treemapHeight={height}
                    debug={debug}
                />
            ))}

            <CausesOfDeathCategoryAnnotations
                data={data}
                metadata={metadata}
                treeNodes={leaves}
                width={width}
                annotationHeight={annotationHeight}
                debug={debug}
            />
        </svg>
    )
}

// export function CausesOfDeathComponent({
//     data,
//     entityName,
//     year,
//     tilingMethod,
//     dimensionsConfig,
//     debug = false,
// }: {
//     data: DataRow[]
//     entityName: EntityName
//     year: Time
//     tilingMethod?: any
//     dimensionsConfig?: {
//         initialWidth?: number
//         ratio?: number
//         minHeight?: number
//         maxHeight?: number
//     }
//     debug?: boolean
// }) {
//     const { ref, dimensions } = useChartDimensions<HTMLDivElement>(
//         {
//             top: 0,
//             right: 0,
//             bottom: 0,
//             left: 0,
//         },
//         {
//             initialWidth: dimensionsConfig?.initialWidth || 900,
//             ratio: dimensionsConfig?.ratio || 3 / 2,
//             minHeight: dimensionsConfig?.minHeight || 400,
//             maxHeight: dimensionsConfig?.maxHeight || 800,
//         }
//     )

//     const width = dimensions.width
//     const isNarrow = width < 768 // same as small breakpoint
//     const height = isNarrow ? 900 : dimensions.height

//     return (
//         <div ref={ref} style={{ position: "relative" }}>
//             <CausesOfDeathTreemap
//                 data={data}
//                 entityName={entityName}
//                 year={year}
//                 tilingMethod={tilingMethod}
//                 width={width}
//                 height={height}
//                 showCategoryAnnotation={!isNarrow}
//                 debug={debug}
//             />
//             <div className="causes-of-death-footer">
//                 <span>
//                     <b>Data source:</b> IHME, Global Burden of Disease (2024)
//                 </span>
//                 <TooltipTrigger>
//                     <Link
//                         className="cc-by-button"
//                         href="https://creativecommons.org/licenses/by/4.0/"
//                         target="_blank"
//                         rel="noopener noreferrer"
//                     >
//                         CC BY
//                     </Link>
//                     <Tooltip className="cc-by-tooltip">
//                         Our World in Data charts are licensed under Creative
//                         Commons; you are free to use, share, and adapt this
//                         material. Click through to the CC BY page for more
//                         information. Please bear in mind that the underlying
//                         source data for all our charts might be subject to
//                         different license terms from third-party authors.
//                     </Tooltip>
//                 </TooltipTrigger>
//             </div>
//         </div>
//     )
// }

function _formatSigFig(value: number): string {
    return d3.format(".2s")(value)
}

function _formatPercent(value: number): string {
    return d3.format(".0%")(value)
}

function _format(value: number): string {
    return d3.format(",~")(value)
}
