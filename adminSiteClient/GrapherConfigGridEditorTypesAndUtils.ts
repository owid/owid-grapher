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
    EqualityComparison,
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

import { GrapherInterface } from "@ourworldindata/types"
import {
    defaultPlaceholderFieldName,
    isRuleGroup,
    type Field,
    type RuleGroupType,
    type RuleType,
} from "react-querybuilder"
import { match } from "ts-pattern"

export function parseVariableAnnotationsRow(
    row: VariableAnnotationsResponseRow
): VariableAnnotationsRow {
    return row // The type defintiion of VariableAnnotationsResponseRow in clientUtils can't use GrapherInterface so we type cast here for now
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

export const initialFilterQuery: RuleGroupType = {
    combinator: "and",
    rules: [],
}

export function getLogicOperator(str: string): BinaryLogicOperators {
    if (str === "and") return BinaryLogicOperators.and
    else if (str === "or") return BinaryLogicOperators.or
    else throw Error(`unknown logic operator: ${str}`)
}

export function getComparisonOperator(
    str: string
): ComparisonOperator | undefined {
    return match(str)
        .with("<", () => ComparisonOperator.less)
        .with("<=", () => ComparisonOperator.lessOrEqual)
        .with(">", () => ComparisonOperator.greater)
        .with(">=", () => ComparisonOperator.greaterOrEqual)
        .otherwise(() => undefined)
}

export function getNullCheckOperator(
    str: string
): NullCheckOperator | undefined {
    return match(str)
        .with("null", () => NullCheckOperator.isNull)
        .with("notNull", () => NullCheckOperator.isNotNull)
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
    if (str === "=") return EqualityOperator.equal
    else if (str === "!=") return EqualityOperator.unequal
    else return undefined
}

/** JsonLogic is the easiest format that react-querybuilder can round
    trip (i.e. deserialize from). Building the internal structure of the query library
    would be tedious so we convert our SExpressions to JsonLogic. */
export function SExpressionToJsonLogic(
    sExpression: Operation,
    readOnlyEntries: Map<string, ReadOnlyColumn>
): JSONPreciselyTyped {
    return sExpression.toJsonLogic({
        processSqlColumnName: (columnName) => {
            const item = readOnlyEntries
                .entries()
                .find(([_, col]) => col.sExpressionColumnTarget === columnName)
            const mappedColumnName = item![0]
            return mappedColumnName
        },
    })
}

/** When we load a filter query from the query string we convert our SExpression
    to JsonLogic and import it with react-querybuilder's parseJsonLogic. Our custom
    operators isLatest/isEarliest have no JsonLogic equivalent and are represented
    as field = "latest" / field = "earliest" - this function walks the imported
    query and turns such rules back into the custom operators. */
export function promoteLatestEarliestToOperators(group: RuleGroupType): void {
    for (const rule of group.rules) {
        if (isRuleGroup(rule)) promoteLatestEarliestToOperators(rule)
        else if (rule.operator === "=" && rule.value === "latest")
            rule.operator = "isLatest"
        else if (rule.operator === "=" && rule.value === "earliest")
            rule.operator = "isEarliest"
    }
}

export function filterQueryToSExpression(
    query: RuleGroupType | RuleType,
    context: OperationContext,
    readOnlyFieldNamesMap: Map<string, ReadOnlyColumn>
): Operation | undefined {
    if (isRuleGroup(query)) {
        // If we have a group then we need to decide
        // on the operator and build the list of children recursively
        const children = excludeUndefined(
            query.rules.map((child) =>
                filterQueryToSExpression(child, context, readOnlyFieldNamesMap)
            )
        )
        if (children.length === 0) return undefined

        const operation = new BinaryLogicOperation(
            getLogicOperator(query.combinator),
            children
        )

        // If not is active, wrap the operation in a Negation
        if (query.not) return new Negation(operation)
        else return operation
    } else {
        // Ignore rules where no field has been selected yet
        if (!query.field || query.field === defaultPlaceholderFieldName)
            return undefined
        const field = getFieldSymbol(
            query.field,
            context,
            readOnlyFieldNamesMap
        )
        const { value } = query
        return (
            match(query.operator)
                // If we have a rule, check what operator is used and build the corresponding operation
                .when(
                    (op) => getComparisonOperator(op) !== undefined,
                    (op) => {
                        const operator = getComparisonOperator(op)!
                        const val =
                            value === "" ? undefined : getValueAtom(value)
                        if (val === undefined) return undefined
                        return new NumericComparison(operator, [field, val])
                    }
                )
                .when(
                    (op) => getEqualityOperator(op) !== undefined,
                    (op) => {
                        const operator = getEqualityOperator(op)!
                        const val = getValueAtom(value)
                        if (val === undefined) return undefined
                        return new EqualityComparison(operator, [field, val])
                    }
                )
                .with("contains", () => {
                    if (typeof value !== "string") return undefined
                    return new StringContainsOperation(
                        field,
                        new StringAtom(value)
                    )
                })
                .when(
                    (op) => getNullCheckOperator(op) !== undefined,
                    (op) => {
                        const operator = getNullCheckOperator(op)!
                        return new NullCheckOperation(operator, field)
                    }
                )
                .with("isEmpty", "isNotEmpty", (operator) => {
                    const op: EqualityOperator = match(operator)
                        .with("isEmpty", () => EqualityOperator.equal)
                        .with("isNotEmpty", () => EqualityOperator.unequal)
                        .exhaustive()
                    return new EqualityComparison(op, [
                        field,
                        new StringAtom(""),
                    ])
                })
                .with("isLatest", () => {
                    return new EqualityComparison(EqualityOperator.equal, [
                        field,
                        new StringAtom("latest"),
                    ])
                })
                .with("isEarliest", () => {
                    return new EqualityComparison(EqualityOperator.equal, [
                        field,
                        new StringAtom("earliest"),
                    ])
                })
                .otherwise(() => undefined)
        )
    }
}

type FieldOperator = {
    name: string
    label: string
    arity?: "unary"
}
type FieldOperators = FieldOperator[]

const equalityOperators: FieldOperators = [
    { name: "=", label: "=" },
    { name: "!=", label: "!=" },
]
const comparisonOperators: FieldOperators = [
    { name: "<", label: "<" },
    { name: "<=", label: "<=" },
    { name: ">", label: ">" },
    { name: ">=", label: ">=" },
]
// Operators with arity "unary" don't show a value editor in the UI
const nullCheckOperators: FieldOperators = [
    { name: "null", label: "is null", arity: "unary" },
    { name: "notNull", label: "is not null", arity: "unary" },
]
const emptinessOperators: FieldOperators = [
    { name: "isEmpty", label: "is empty", arity: "unary" },
    { name: "isNotEmpty", label: "is not empty", arity: "unary" },
]
/** Custom operators for year fields that can be set to "latest"/"earliest".
    They are translated to `field = "latest"` etc. in the S-expression. */
const latestEarliestOperators: FieldOperators = [
    { name: "isLatest", label: "is latest", arity: "unary" },
    { name: "isEarliest", label: "is earliest", arity: "unary" },
]

const textOperators: FieldOperators = [
    ...equalityOperators,
    { name: "contains", label: "contains" },
    ...emptinessOperators,
    ...nullCheckOperators,
]
const numberOperators: FieldOperators = [
    ...equalityOperators,
    ...comparisonOperators,
    ...nullCheckOperators,
]
const datetimeOperators: FieldOperators = [
    ...equalityOperators,
    ...comparisonOperators,
    ...nullCheckOperators,
]
const selectOperators: FieldOperators = [
    ...equalityOperators,
    ...nullCheckOperators,
]
const booleanOperators: FieldOperators = [
    ...equalityOperators,
    ...nullCheckOperators,
]

export function simpleColumnToFilterPanelFieldConfig(
    column: ReadOnlyColumn
): Field {
    const common = { name: column.key, label: column.label }
    return match(column.type)
        .returnType<Field>()
        .with("string", () => ({
            ...common,
            inputType: "text",
            operators: textOperators,
        }))
        .with("number", () => ({
            ...common,
            inputType: "number",
            operators: numberOperators,
        }))
        .with("datetime", () => ({
            ...common,
            inputType: "datetime-local",
            operators: datetimeOperators,
        }))
        .exhaustive()
}

export function fieldDescriptionToFilterPanelFieldConfig(
    description: FieldDescription
): Field | undefined {
    const common = { name: description.pointer, label: description.pointer }
    return match(description.editor)
        .returnType<Field | undefined>()
        .with(EditorOption.checkbox, () => ({
            ...common,
            valueEditorType: "switch",
            defaultValue: false,
            operators: booleanOperators,
        }))
        .with(EditorOption.dropdown, () => ({
            ...common,
            valueEditorType: "select",
            values: (description.enumOptions ?? []).map((option) => ({
                name: option,
                label: option,
            })),
            operators: selectOperators,
        }))
        .with(EditorOption.numeric, () => ({
            ...common,
            inputType: "number",
            operators: numberOperators,
        }))
        .with(EditorOption.numericWithLatestEarliest, () => ({
            ...common,
            inputType: "number",
            operators: [...numberOperators, ...latestEarliestOperators],
        }))
        .with(EditorOption.textarea, EditorOption.textfield, () => ({
            ...common,
            inputType: "text",
            operators: textOperators,
        }))
        .with(
            EditorOption.colorEditor,
            EditorOption.mappingEditor,
            EditorOption.primitiveListEditor,
            () => undefined
        )
        .exhaustive()
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
