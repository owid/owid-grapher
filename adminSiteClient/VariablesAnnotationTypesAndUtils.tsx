import { queryParamsToStr } from "../clientUtils/urls/UrlUtils.js"
import {
    BinaryLogicOperation,
    BinaryLogicOperators,
    BooleanOperation,
    Operation,
    StringAtom,
    StringContainsOperation,
    StringOperation,
} from "../clientUtils/SqlFilterSExpression.js"
import React from "react"
import { IconDefinition } from "@fortawesome/fontawesome-common-types/index.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

import { GrapherInterface } from "../grapher/core/GrapherInterface.js"
import {
    VariableAnnotationsResponseRow,
    VariableAnnotationPatch,
} from "../clientUtils/AdminSessionTypes.js"
export function parseVariableAnnotationsRow(
    row: VariableAnnotationsResponseRow
): VariableAnnotationsRow {
    return row as VariableAnnotationsRow // The type defintiion of VariableAnnotationsResponseRow in clientUtils can't use GrapherInterface so we type cast here for now
}

export interface VariableAnnotationsRow {
    id: number
    name: string
    grapherConfig: GrapherInterface
    datasetname: string
    namespacename: string
}

export interface ColumnReorderItem {
    key: string
    visible: boolean
    description: string
}

export interface Action {
    patches: VariableAnnotationPatch[]
}

export const PAGEING_SIZE: number = 50
export enum Tabs {
    EditorTab = "EditorTab",
    FilterTab = "FilterTab",
    ColumnsTab = "ColumnsTab",
}

export const ALL_TABS = Object.values(Tabs)

export const HIDDEN_COLUMNS = new Set([
    "/$schema",
    "/id",
    "/map/variableId",
    "/version",
    "/dimensions/0/variableId",
    "/dimensions/0/property",
    "/slug",
    "/data",
    "/xAxis/removePointsOutsideDomain",
    "/xAxis/label",
    "/xAxis/min",
    "/xAxis/scaleType",
    "/xAxis/max",
    "/xAxis/canChangeScaleType",
    "/xAxis/facetDomain",
])

export interface FullColumnSet {
    label: "All columns"
    kind: "allColumns"
}

export interface SpecificColumnSet {
    label: string
    kind: "specificColumns"
    columns: string[]
}

export type ColumnSet = FullColumnSet | SpecificColumnSet

export const columnSets: ColumnSet[] = [
    {
        label: "Common",
        kind: "specificColumns",
        columns: [
            "name",
            "datasetname",
            "/type",
            "/hasMapTab",
            "/title",
            "/subtitle",
            "/note",
            "/dimensions/0/display/unit",
            "/dimensions/0/display/shortUnit",
        ],
    },
    { label: "All columns", kind: "allColumns" },
    {
        label: "Axis",
        kind: "specificColumns",
        columns: [
            "name",
            "datasetname",
            "/yAxis/removePointsOutsideDomain",
            "/yAxis/label",
            "/yAxis/min",
            "/yAxis/scaleType",
            "/yAxis/max",
            "/yAxis/canChangeScaleType",
            "/yAxis/facetDomain",
        ],
    },
]

/** All the parameters we need for making a fully specified request to the /variable-annotations
    endpoint. When any of these fields change we need to trigger a new request */
export interface FetchVariablesParameters {
    pagingOffset: number
    filterQuery: Operation
    sortByColumn: string // sort is currently ignored but here for future use
    sortByAscending: boolean // sort is currently ignored but here for future use
}

export function fetchVariablesParametersToQueryParametersString(
    params: FetchVariablesParameters
): string {
    return queryParamsToStr({
        filter: params.filterQuery.toSExpr(),
        offset: params.pagingOffset.toString(),
    })
}

export interface IconToggleProps {
    isOn: boolean
    onIcon: IconDefinition
    offIcon: IconDefinition
    onClick: (newState: boolean) => void
}

export const IconToggleComponent = (props: IconToggleProps) => (
    <button
        className="btn btn-light btn-sm"
        onClick={() => props.onClick(!props.isOn)}
    >
        <FontAwesomeIcon icon={props.isOn ? props.onIcon : props.offIcon} />
    </button>
)

/** Turns a search string like "nuclear share" into a BooleanOperation
    that AND connects a CONTAINS query for every word - i.e. it would result in
    (AND (CONTAINS target "nuclear") (CONTAINS target "share"))  */
export function searchFieldStringToFilterOperations(
    searchString: string,
    target: StringOperation
): BooleanOperation | undefined {
    const fragments = searchString
        .split(" ")
        .map((item) => item.trim())
        .filter((item) => item !== "")
    const wordContainsParts = fragments.map(
        (fragment) =>
            new StringContainsOperation(target, new StringAtom(fragment))
    )
    if (fragments.length > 0)
        return new BinaryLogicOperation(
            BinaryLogicOperators.and,
            wordContainsParts
        )
    else return undefined
}

export const getItemStyle = (
    isDragging: boolean,
    draggableStyle: any
): any => ({
    userSelect: "none",
    // change background colour if dragging
    background: isDragging ? "lightgreen" : "inherit",

    // styles we need to apply on draggables
    ...draggableStyle,
})
