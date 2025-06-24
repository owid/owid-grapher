// FIXME: Don't mix components and business logic in this file.
/* eslint-disable react-refresh/only-export-components */
import * as _ from "lodash-es"
import {
    excludeUndefined,
    QueryParams,
    queryParamsToStr,
} from "@ourworldindata/utils"
import {
    BinaryLogicOperation,
    BinaryLogicOperators,
    BooleanAtom,
    BooleanOperation,
    ComparisonOperator,
    EqualityComparision,
    EqualityOperator,
    JsonPointerSymbol,
    JSONPreciselyTyped,
    Negation,
    NullCheckOperation,
    NullCheckOperator,
    NumberAtom,
    NumericComparison,
    Operation,
    OperationContext,
    parseToOperation,
    SqlColumnName,
    StringAtom,
    StringContainsOperation,
    StringOperation,
} from "../adminShared/SqlFilterSExpression.js"
import {
    GrapherConfigPatch,
    VariableAnnotationsResponseRow,
} from "../adminShared/AdminSessionTypes.js"
import {
    EditorOption,
    FieldDescription,
} from "../adminShared/schemaProcessing.js"
import { IconDefinition } from "@fortawesome/fontawesome-common-types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

import { GrapherInterface } from "@ourworldindata/types"
import {
    AntdConfig,
    BasicConfig,
    JsonTree,
    SimpleField,
    Utils as QbUtils,
    JsonGroup,
    JsonItem,
    Config,
    ImmutableTree,
} from "@react-awesome-query-builder/antd"
import { match } from "ts-pattern"
import * as R from "remeda"

export function parseVariableAnnotationsRow(
    row: VariableAnnotationsResponseRow
): VariableAnnotationsRow {
    return row as VariableAnnotationsRow // The type defintiion of VariableAnnotationsResponseRow in clientUtils can't use GrapherInterface so we type cast here for now
}

export enum GrapherConfigGridEditorSource {
    SourceVariableAnnotation = "SourceVariableAnnotation",
    SourceCharts = "SourceCharts",
}

export interface BulkGrapherConfigRow {
    id: number
    config: GrapherInterface
    createdAt: string
    updatedAt: string
}

export interface VariableAnnotationsRow extends BulkGrapherConfigRow {
    name: string
    datasetname: string
    namespacename: string
    description: string
}

export interface BulkChartEditRow extends BulkGrapherConfigRow {
    lastEditedAt: string
    publishedAt: string
    lastEditedByUser: string
    publishedByUser: string
}

export interface ColumnInformation {
    key: string
    visible: boolean
    description: string
}

export interface Action {
    patches: GrapherConfigPatch[]
}

export const PAGEING_SIZE: number = 50
export enum Tabs {
    EditorTab = "EditorTab",
    FilterTab = "FilterTab",
    ColumnsTab = "ColumnsTab",
}

export const ALL_TABS = Object.values(Tabs)

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

/** All the parameters we need for making a fully specified request to the /variable-annotations
    endpoint. When any of these fields change we need to trigger a new request */
export interface FetchVariablesParameters {
    offset: number
    filterQuery: Operation
    sortByColumn: string // sort is currently ignored but here for future use
    sortByAscending: boolean // sort is currently ignored but here for future use
}

export const filterExpressionNoFilter = new BooleanAtom(true)

export function fetchVariablesParametersFromQueryString(
    params: QueryParams,
    sExpressionContext: OperationContext
): FetchVariablesParameters {
    let filterQuery: Operation | undefined = undefined
    if (Object.prototype.hasOwnProperty.call(params, "filter")) {
        filterQuery = parseToOperation(params.filter!, sExpressionContext)
    }
    return {
        offset: Number.parseInt(params.offset ?? "0"),
        filterQuery: filterQuery ?? filterExpressionNoFilter,
        sortByColumn: params.sortByColumn ?? "id",
        sortByAscending: params.sortByAscending === "true",
    }
}

export function fetchVariablesParametersToQueryParameters(
    params: FetchVariablesParameters
) {
    return {
        filter: params.filterQuery.toSExpr(),
        offset: params.offset.toString(),
        sortByColumn: params.sortByColumn,
        sortByAscending: params.sortByAscending.toString(),
    }
}

export function fetchVariablesParametersToQueryParametersString(
    params: FetchVariablesParameters
): string {
    return queryParamsToStr(fetchVariablesParametersToQueryParameters(params))
}

export interface IconToggleProps {
    isOn: boolean
    onIcon: IconDefinition
    offIcon: IconDefinition
    onClick: (newState: boolean) => void
}

export enum ColumnDataSourceType {
    FieldDescription = "FieldDescription",
    MultipleFieldDescriptions = "MultipleFieldDescriptions",
    ReadOnlyColumn = "ReadOnlyColumn",
    Unkown = "Unknown",
}

export interface ColumnDataSourceFieldDescription {
    kind: ColumnDataSourceType.FieldDescription
    description: FieldDescription
    columnInformation: ColumnInformation
}

export interface ColumnDataSourceReadOnlyColumn {
    kind: ColumnDataSourceType.ReadOnlyColumn
    readOnlyColumn: ReadOnlyColumn
    columnInformation: ColumnInformation
}

export interface ColumnDataSourceUnknown {
    kind: ColumnDataSourceType.Unkown
    fieldKey: string
    columnInformation: ColumnInformation
}
export type ColumnDataSource =
    | ColumnDataSourceFieldDescription
    | ColumnDataSourceReadOnlyColumn
    | ColumnDataSourceUnknown

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

export const filterPanelInitialConfig: BasicConfig = AntdConfig

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

export function getFieldSymbol(
    fieldName: string,
    context: OperationContext,
    readOnlyFieldNamesMap: Map<string, ReadOnlyColumn>
): Operation {
    if (isConfigColumn(fieldName))
        return new JsonPointerSymbol(fieldName, context)
    else
        return new SqlColumnName(
            readOnlyFieldNamesMap.get(fieldName)!.sExpressionColumnTarget,
            context
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

/** JsonLogic is the easiest format that the React Awesome Query Builder can round
    trip (i.e. deserialize from). Building the internal structure of the query library
    would be tedious so we convert our SExpressions to JsonLogic. */
export function SExpressionToJsonLogic(
    sExpression: Operation,
    readOnlyEntries: Map<string, ReadOnlyColumn>
): JSONPreciselyTyped {
    return sExpression.toJsonLogic({
        processSqlColumnName: (columnName) => {
            const item = [...readOnlyEntries.entries()].find(
                (item) => item[1].sExpressionColumnTarget === columnName
            )
            const mappedColumnName = item![0]
            return mappedColumnName
        },
    })
}

/** JsonLogic is the easiest format that the React Awesome Query Library can round
    trip (i.e. deserialize from). Building the internal structure of the query library
    would be tedious so we convert our SExpressions to JsonLogic. When React Awesome
    Query Library parses this, we need to convert some custom things like the is_latest
    query operator that we added to RAQL that in our SExpressions are represented as
    field = "latest"
 */
export function postprocessJsonLogicTree(filterTree: JsonTree | JsonItem) {
    if (filterTree.type === "group" && filterTree.children1) {
        if (
            _.isArray(filterTree.children1) ||
            R.isPlainObject(filterTree.children1)
        )
            for (const child of Object.values(filterTree.children1))
                postprocessJsonLogicTree(child)
    } else if (filterTree.type === "rule") {
        const {
            properties: { value, operator },
        } = filterTree

        if (value.length !== 1) return

        const isLatest = value[0] === "latest"

        const isEarliest = value[0] === "earliest"

        const isEqual = operator === "equal" || operator === "select_equals"
        if (isLatest && isEqual) {
            filterTree.properties.operator = "is_latest"
        } else if (isEarliest && isEqual) {
            filterTree.properties.operator = "is_earliest"
        }
    }
}
export function filterTreeToSExpression(
    filterTree: JsonTree | JsonItem,
    context: OperationContext,
    readOnlyFieldNamesMap: Map<string, ReadOnlyColumn>
): Operation | undefined {
    if (filterTree.type === "group") {
        // If we have a group then we need to decide
        // on the operator and build the list of children recursively
        const logicOperator = getLogicOperator(
            filterTree.properties?.conjunction ?? "AND"
        )

        let children: Operation[] = []
        if (
            _.isArray(filterTree.children1) ||
            R.isPlainObject(filterTree.children1)
        )
            children = excludeUndefined(
                Object.values(filterTree.children1).map((child) =>
                    filterTreeToSExpression(
                        child,
                        context,
                        readOnlyFieldNamesMap
                    )
                )
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
        if (_.isNil(filterTree.properties.field)) return undefined
        const field = getFieldSymbol(
            filterTree.properties.field as string,
            context,
            readOnlyFieldNamesMap
        )
        return (
            match(filterTree.properties.operator)
                // If we have a rule, check what operator is used and build the corresponding operation
                .when(
                    (op) => op && getComparisonOperator(op),
                    (op) => {
                        const operator = getComparisonOperator(op as string)
                        if (
                            filterTree.properties.value.length === 0 ||
                            filterTree.properties.value[0] === undefined
                        )
                            return undefined
                        const val = getValueAtom(filterTree.properties.value[0])
                        return new NumericComparison(operator!, [field, val!])
                    }
                )
                .when(
                    (op) => op && getEqualityOperator(op),
                    (op) => {
                        const operator = getEqualityOperator(op as string)
                        const val = getValueAtom(filterTree.properties.value[0])
                        if (val === undefined) return undefined
                        return new EqualityComparision(operator!, [field, val])
                    }
                )
                .when(
                    (op) => op && op === "like",
                    () => {
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
                        return new NullCheckOperation(operator!, field)
                    }
                )
                .with("is_empty", "is_not_empty", (operator) => {
                    const op: EqualityOperator = match(operator)
                        .with("is_empty", () => EqualityOperator.equal)
                        .with("is_not_empty", () => EqualityOperator.unequal)
                        .exhaustive()
                    return new EqualityComparision(op, [
                        field,
                        new StringAtom(""),
                    ])
                })
                .with("is_latest", (_) => {
                    return new EqualityComparision(EqualityOperator.equal, [
                        field,
                        new StringAtom("latest"),
                    ])
                })
                .with("is_earliest", (_) => {
                    return new EqualityComparision(EqualityOperator.equal, [
                        field,
                        new StringAtom("earliest"),
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
            label: column.label,
            type: fieldType,
            valueSources: ["value"],
            excludeOperators: ["is_latest", "is_earliest"],
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
        .with(EditorOption.numericWithLatestEarliest, () => "number")
        .with(EditorOption.primitiveListEditor, () => undefined)
        .with(EditorOption.textarea, () => "text")
        .with(EditorOption.textfield, () => "text")
        .exhaustive()

    if (widget !== undefined) {
        const excludedOperators =
            description.editor === EditorOption.numericWithLatestEarliest
                ? []
                : ["is_latest", "is_earliest"]
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
                excludeOperators: excludedOperators,
            },
        ]
    } else return undefined
}

export interface GrapherConfigGridEditorConfig {
    source: GrapherConfigGridEditorSource
    sExpressionContext: OperationContext
    apiEndpoint: string
    readonlyColumns: Map<string, ReadOnlyColumn>
    hiddenColumns: Set<string>
    columnSet: ColumnSet[]
    finalVariableLayerModificationFn: (id: number) => Partial<GrapherInterface>
}
export interface GrapherConfigGridEditorProps {
    config: GrapherConfigGridEditorConfig
}
