import { queryParamsToStr } from "../clientUtils/urls/UrlUtils.js"
import {
    BinaryLogicOperation,
    BinaryLogicOperators,
    BooleanAtom,
    ComparisonOperator,
    EqualityComparision,
    EqualityOperator,
    JsonPointerSymbol,
    Negation,
    NumberAtom,
    NumericComparision,
    Operation,
    SqlColumnName,
    StringAtom,
    StringContainsOperation,
    NullCheckOperation,
    NullCheckOperator,
    StringOperation,
    BooleanOperation,
} from "../clientUtils/SqlFilterSExpression.js"
import * as React from "react"
import { IconDefinition } from "@fortawesome/fontawesome-common-types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import { GrapherInterface } from "../grapher/core/GrapherInterface.js"
import {
    VariableAnnotationsResponseRow,
    VariableAnnotationPatch,
} from "../clientUtils/AdminSessionTypes.js"
import AntdConfig from "react-awesome-query-builder/lib/config/antd"
import {
    BasicConfig,
    Builder,
    BuilderProps,
    SimpleField,
} from "react-awesome-query-builder"
import { Utils as QbUtils } from "react-awesome-query-builder"
// types
import {
    JsonGroup,
    JsonItem,
    Config,
    ImmutableTree,
} from "react-awesome-query-builder"
import { match } from "ts-pattern"
import { excludeUndefined, isArray } from "../clientUtils/Util.js"
import { isPlainObject } from "lodash"
import {
    EditorOption,
    FieldDescription,
} from "../clientUtils/schemaProcessing.js"

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
    description: string
    createdAt: string
    updatedAt: string
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

// TODO: create a type and add the correct column names for the query

export interface ReadOnlyColumn {
    label: string
    key: string
    type: "string" | "datetime" | "number"
    sExpressionColumnTarget: string
}

export const readOnlyColumnNamesFields: Map<string, ReadOnlyColumn> = new Map(
    [
        {
            key: "id",
            label: "Id",
            type: "number" as const,
            sExpressionColumnTarget: "id",
        },
        {
            key: "name",
            label: "Variable name",
            type: "string" as const,
            sExpressionColumnTarget: "variables.name",
        },
        {
            key: "datasetname",
            label: "Dataset name",
            type: "string" as const,
            sExpressionColumnTarget: "datasets.name",
        },
        {
            key: "namespacename",
            label: "Namespace name",
            type: "string" as const,
            sExpressionColumnTarget: "namespaces.name",
        },
        {
            key: "description",
            label: "Description",
            type: "string" as const,
            sExpressionColumnTarget: "variables.description",
        },
        {
            key: "createdAt",
            label: "Created at",
            type: "datetime" as const,
            sExpressionColumnTarget: "variables.createdAt",
        },
        {
            key: "updatedAt",
            label: "Updated at",
            type: "datetime" as const,
            sExpressionColumnTarget: "variables.updatedAt",
        },
    ].map((item) => [item.key, item])
)

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

export function isConfigColumn(columnName: string): boolean {
    return columnName.startsWith("/")
}

export const filterPanelInitialConfig: BasicConfig = AntdConfig as BasicConfig
export const initialFilterQueryValue: JsonGroup = {
    id: QbUtils.uuid(),
    type: "group",
}
export type FilterPanelState = {
    tree: ImmutableTree
    config: Config
}

export function getLogicOperator(str: string): BinaryLogicOperators {
    if (str === "AND") return BinaryLogicOperators.and
    else if (str === "OR") return BinaryLogicOperators.or
    else throw Error(`unknown logic operator: ${str}`)
}

export function getComparisonOperator(
    str: string
): ComparisonOperator | undefined {
    return match(str)
        .with("less", () => ComparisonOperator.less)
        .with("less_or_equal", () => ComparisonOperator.lessOrEqual)
        .with("greater", () => ComparisonOperator.greater)
        .with("greater_or_equal", () => ComparisonOperator.greaterOrEqual)
        .otherwise(() => undefined)
}

export function getNullCheckOperator(
    str: string
): NullCheckOperator | undefined {
    return match(str)
        .with("is_null", () => NullCheckOperator.isNull)
        .with("is_not_null", () => NullCheckOperator.isNotNull)
        .otherwise(() => undefined)
}

export function getFieldSymbol(fieldName: string): Operation {
    if (isConfigColumn(fieldName)) return new JsonPointerSymbol(fieldName)
    else
        return new SqlColumnName(
            readOnlyColumnNamesFields.get(fieldName)!.sExpressionColumnTarget
        )
}

export function getValueAtom(val: any): Operation | undefined {
    if (typeof val === "string") return new StringAtom(val)
    else if (typeof val === "number") return new NumberAtom(val)
    else if (typeof val === "boolean") return new BooleanAtom(val)
    else return undefined
}

export function getEqualityOperator(str: string): EqualityOperator | undefined {
    if (str === "equal" || str === "select_equals")
        return EqualityOperator.equal
    else if (str === "not_equal" || str === "select_not_equals")
        return EqualityOperator.unequal
    else return undefined
}

export function filterTreeToSExpression(
    filterTree: JsonItem
): Operation | undefined {
    if (filterTree.type === "group") {
        // If we have a group then we need to decide
        // on the operator and build the list of children recursively
        const logicOperator = getLogicOperator(
            filterTree.properties?.conjunction ?? "AND"
        )

        let children: Operation[] = []
        if (isArray(filterTree.children1))
            children = excludeUndefined(
                filterTree.children1?.map(filterTreeToSExpression)
            )
        else if (isPlainObject(filterTree.children1))
            children = excludeUndefined(
                Object.values(
                    filterTree.children1 as Record<string, JsonItem>
                ).map(filterTreeToSExpression)
            )
        else if (filterTree.children1 !== undefined)
            console.warn("unexpected content of children1")

        if (filterTree.children1 === undefined || children.length === 0)
            return undefined

        const operation = new BinaryLogicOperation(logicOperator, children)

        // If not is active, wrap the operation in a Negation
        if (filterTree.properties?.not) return new Negation(operation)
        else return operation
    } else if (filterTree.type === "rule") {
        return (
            match(filterTree.properties.operator)
                // If we have a rule, check what operator is used and build the corresponding operation
                .when(
                    (op) => op && getComparisonOperator(op),
                    (op) => {
                        const operator = getComparisonOperator(op as string)
                        const field = getFieldSymbol(
                            filterTree.properties.field!
                        )
                        if (
                            filterTree.properties.value.length === 0 ||
                            filterTree.properties.value[0] === undefined
                        )
                            return undefined
                        const val = getValueAtom(filterTree.properties.value[0])
                        return new NumericComparision(operator!, [field, val!])
                    }
                )
                .when(
                    (op) => op && getEqualityOperator(op),
                    (op) => {
                        const operator = getEqualityOperator(op as string)
                        const field = getFieldSymbol(
                            filterTree.properties.field!
                        )
                        const val = getValueAtom(filterTree.properties.value[0])
                        if (val === undefined) return undefined
                        return new EqualityComparision(operator!, [field, val])
                    }
                )
                .when(
                    (op) => op && op === "like",
                    () => {
                        const field = getFieldSymbol(
                            filterTree.properties.field!
                        )
                        if (
                            filterTree.properties.value.length === 0 ||
                            filterTree.properties.value[0] === undefined
                        )
                            return undefined
                        const val = new StringAtom(
                            filterTree.properties.value[0]
                        )
                        return new StringContainsOperation(field, val)
                    }
                )
                .when(
                    (op) => op && getNullCheckOperator(op as string),
                    (op) => {
                        const operator = getNullCheckOperator(op as string)!
                        const field = getFieldSymbol(
                            filterTree.properties.field!
                        )
                        return new NullCheckOperation(operator!, field)
                    }
                )
                .with("is_empty", "is_not_empty", (operator) => {
                    const field = getFieldSymbol(filterTree.properties.field!)
                    const op: EqualityOperator = match(operator)
                        .with("is_empty", () => EqualityOperator.equal)
                        .with("is_not_empty", () => EqualityOperator.unequal)
                        .exhaustive()
                    return new EqualityComparision(op, [
                        field,
                        new StringAtom(""),
                    ])
                })

                .otherwise(() => undefined)
        )
    }
    return undefined
}

export function simpleColumnToFilterPanelFieldConfig(
    column: ReadOnlyColumn
): [string, SimpleField] {
    const fieldType = match(column.type)
        .with("string", () => "text")
        .with("number", () => "number")
        .with("datetime", () => "datetime")
        .exhaustive()

    return [
        column.key,
        {
            label: column.key,
            type: fieldType,
            valueSources: ["value"],
            //preferWidgets: widget [widget],
        },
    ]
}

export function fieldDescriptionToFilterPanelFieldConfig(
    description: FieldDescription
): [string, SimpleField] | undefined {
    const widget = match(description.editor)
        .with(EditorOption.checkbox, () => "boolean")
        .with(EditorOption.colorEditor, () => undefined)
        .with(EditorOption.dropdown, () => "select")
        .with(EditorOption.mappingEditor, () => undefined)
        .with(EditorOption.numeric, () => "number")
        .with(EditorOption.primitiveListEditor, () => undefined)
        .with(EditorOption.textarea, () => "text")
        .with(EditorOption.textfield, () => "text")
        .exhaustive()

    if (widget !== undefined)
        return [
            description.pointer,
            {
                label: description.pointer,
                type: widget,
                valueSources: ["value"],
                //preferWidgets: widget [widget],
                fieldSettings: {
                    listValues: description.enumOptions,
                },
            },
        ]
    else return undefined
}

export function renderBuilder(props: BuilderProps) {
    return (
        <div className="query-builder-container" style={{ padding: "0" }}>
            <div className="query-builder qb-lite">
                <Builder {...props} />
            </div>
        </div>
    )
}
export function getFinalConfigLayerForVariable(id: number) {
    return {
        version: 1,
        dimensions: [{ property: "y", variableId: id }],
        map: {
            variableId: id,
        },
    }
}
