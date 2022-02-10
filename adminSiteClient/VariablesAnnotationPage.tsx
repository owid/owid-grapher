import * as React from "react"
import { VariableAnnotationPatch } from "../clientUtils/AdminSessionTypes"
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from "react-beautiful-dnd"
import { Disposer, observer } from "mobx-react"
import { observable, computed, action, runInAction, autorun } from "mobx"
import { match, __ } from "ts-pattern"
//import * as lodash from "lodash"
import {
    cloneDeep,
    findLastIndex,
    fromPairs,
    isArray,
    isEmpty,
    isEqual,
    isNil,
    isPlainObject,
    merge,
} from "lodash"

import { HotColumn, HotTable } from "@handsontable/react"
import { AdminLayout } from "./AdminLayout"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { applyPatch } from "../clientUtils/patchHelper"
import {
    FieldDescription,
    extractFieldDescriptionsFromSchema,
    FieldType,
    EditorOption,
} from "../clientUtils/schemaProcessing"

import Handsontable from "handsontable"
import { Bounds } from "../clientUtils/Bounds"
import { Grapher, GrapherProgrammaticInterface } from "../grapher/core/Grapher"
import { BindString, SelectField } from "./Forms"
import { from } from "rxjs"
import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    switchMap,
} from "rxjs/operators"
import { fromFetch } from "rxjs/fetch"
import { toStream, fromStream } from "mobx-utils"
import {
    stringifyUnkownError,
    excludeUndefined,
    moveArrayItemToIndex,
} from "../clientUtils/Util"
import { faEye } from "@fortawesome/free-solid-svg-icons/faEye"
import { faEyeSlash } from "@fortawesome/free-solid-svg-icons/faEyeSlash"
import {
    allComparisonOperators,
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
    WHITELISTED_SQL_COLUM_NAMES,
    StringAtom,
    StringContainsOperation,
    NullCheckOperation,
    NullCheckOperator,
    NumericOperation,
} from "../clientUtils/SqlFilterSExpression"
import {
    parseVariableAnnotationsRow,
    VariableAnnotationsRow,
    ColumnReorderItem,
    Action,
    PAGEING_SIZE,
    Tabs,
    ALL_TABS,
    HIDDEN_COLUMNS,
    ColumnSet,
    FetchVariablesParameters,
    fetchVariablesParametersToQueryParametersString,
    IconToggleComponent,
    searchFieldStringToFilterOperations,
    getItemStyle,
    columnSets,
    isConfigColumn,
    readOnlyColumnNamesFields,
    ReadOnlyColumn,
} from "./VariablesAnnotationTypesAndUtils"
import AntdConfig from "react-awesome-query-builder/lib/config/antd"
import { BasicConfig } from "react-awesome-query-builder"
import { Query, Builder, Utils as QbUtils } from "react-awesome-query-builder"
// types
import {
    JsonGroup,
    JsonTree,
    JsonItem,
    SimpleField,
    Config,
    ImmutableTree,
    BuilderProps,
} from "react-awesome-query-builder"

const filterPanelInitialConfig: BasicConfig = AntdConfig as BasicConfig
const initialFilterQueryValue: JsonGroup = { id: QbUtils.uuid(), type: "group" }
type FilterPanelState = {
    tree: ImmutableTree
    config: Config
}

function getLogicOperator(str: string): BinaryLogicOperators {
    if (str === "AND") return BinaryLogicOperators.and
    else if (str === "OR") return BinaryLogicOperators.or
    else throw Error(`unknown logic operator: ${str}`)
}

function getComparisonOperator(str: string): ComparisonOperator | undefined {
    return match(str)
        .with("less", () => ComparisonOperator.less)
        .with("less_or_equal", () => ComparisonOperator.lessOrEqual)
        .with("greater", () => ComparisonOperator.greater)
        .with("greater_or_equal", () => ComparisonOperator.greaterOrEqual)
        .otherwise(() => undefined)
}

function getNullCheckOperator(str: string): NullCheckOperator | undefined {
    return match(str)
        .with("is_null", () => NullCheckOperator.isNull)
        .with("is_not_null", () => NullCheckOperator.isNotNull)
        .otherwise(() => undefined)
}

function getFieldSymbol(fieldName: string): Operation {
    if (isConfigColumn(fieldName)) return new JsonPointerSymbol(fieldName)
    else
        return new SqlColumnName(
            readOnlyColumnNamesFields.get(fieldName)!.sExpressionColumnTarget
        )
}

function getValueAtom(val: any): Operation | undefined {
    if (typeof val === "string") return new StringAtom(val)
    else if (typeof val === "number") return new NumberAtom(val)
    else if (typeof val === "boolean") return new BooleanAtom(val)
    else return undefined
}

function getEqualityOperator(str: string): EqualityOperator | undefined {
    if (str === "equal" || str === "select_equals")
        return EqualityOperator.equal
    else if (str === "not_equal" || str === "select_not_equals")
        return EqualityOperator.unequal
    else return undefined
}

function filterTreeToSExpression(filterTree: JsonItem): Operation | undefined {
    if (filterTree.type === "group") {
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
        if (filterTree.properties?.not) return new Negation(operation)
        else return operation
    } else if (filterTree.type === "rule") {
        return match(filterTree.properties.operator)
            .when(
                (op) => op && getComparisonOperator(op),
                (op) => {
                    const operator = getComparisonOperator(op as string)
                    const field = getFieldSymbol(filterTree.properties.field!)
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
                    const field = getFieldSymbol(filterTree.properties.field!)
                    const val = getValueAtom(filterTree.properties.value[0])
                    if (val === undefined) return undefined
                    return new EqualityComparision(operator!, [field, val])
                }
            )
            .when(
                (op) => op && op === "like",
                (op) => {
                    const field = getFieldSymbol(filterTree.properties.field!)
                    if (
                        filterTree.properties.value.length === 0 ||
                        filterTree.properties.value[0] === undefined
                    )
                        return undefined
                    const val = new StringAtom(filterTree.properties.value[0])
                    return new StringContainsOperation(field, val)
                }
            )
            .when(
                (op) => op && getNullCheckOperator(op as string),
                (op) => {
                    const operator = getNullCheckOperator(op as string)!
                    const field = getFieldSymbol(filterTree.properties.field!)
                    return new NullCheckOperation(operator!, field)
                }
            )
            .otherwise(() => undefined)
    }
    return undefined
}

@observer
class VariablesAnnotationComponent extends React.Component {
    static contextType = AdminAppContext

    @observable.ref grapher = new Grapher() // the grapher instance we keep around and update
    @observable.ref grapherElement?: JSX.Element // the JSX Element of the preview IF we want to display it currently
    numTotalRows: number | undefined = undefined
    selectedRow: number | undefined = undefined
    @observable activeTab = Tabs.FilterTab
    @observable currentColumnSet: ColumnSet = columnSets[0]
    @observable columnFilter: string = ""

    @observable.ref columnSelection: ColumnReorderItem[] = []

    context!: AdminAppContextType
    /** This array contains a description for every column, information like which field
        to display, what editor control should be used, ... */
    @observable.ref fieldDescriptions: FieldDescription[] | undefined =
        undefined

    /** Rows of the query result to the /variable-annotations endpoint that include a parsed
        grapher object for the grapherConfig field */
    @observable.ref richDataRows: VariableAnnotationsRow[] | undefined =
        undefined

    /** Undo stack - not yet used - TODO: implement Undo/redo */
    @observable undoStack: Action[] = []
    /** Redo stack - not yet used */
    @observable redoStack: Action[] = []
    // Filter fields and paging offset
    @observable variableNameFilter: string | undefined = undefined
    @observable datasetNameFilter: string = ""
    /** This field stores the offset of what is currently displayed on screen */
    @observable currentPagingOffset: number = 0
    /** This field stores the offset that the user requested. E.g. if the user clicks
        the "Next page" quickly twice then this field will be 2 paging offsets higher
        than currentPagingOffset until the request to retrieve that data is complete
        at which point they will be the same */
    @observable desiredPagingOffset: number = 0
    // Sorting fields - not yet used - TODO: implement sorting
    @observable sortByColumn: string = "id"
    @observable sortByAscending: boolean = false
    disposers: Disposer[] = []
    /** Computed property that combines all relevant filter, paging and offset
        properties into a FetchVariablesParameter object that is used to construct
        the query */
    @computed get dataFetchParameters(): FetchVariablesParameters {
        const {
            variableNameFilter,
            datasetNameFilter,
            desiredPagingOffset,
            sortByAscending,
            sortByColumn,
            filterSExpression,
        } = this
        const filterOperations = excludeUndefined([
            searchFieldStringToFilterOperations(
                variableNameFilter ?? "",
                new SqlColumnName(
                    WHITELISTED_SQL_COLUM_NAMES.SQL_COLUMN_NAME_VARIABLE_NAME
                )
            ),
            searchFieldStringToFilterOperations(
                datasetNameFilter ?? "",
                new SqlColumnName(
                    WHITELISTED_SQL_COLUM_NAMES.SQL_COLUMN_NAME_DATASET_NAME
                )
            ),
            filterSExpression,
        ])
        const filterQuery =
            filterOperations.length === 0
                ? new BooleanAtom(true)
                : new BinaryLogicOperation(
                      BinaryLogicOperators.and,
                      filterOperations
                  )
        return {
            pagingOffset: desiredPagingOffset,
            filterQuery,
            sortByColumn,
            sortByAscending,
        }
    }
    /** Here is some of the most important code in this component - the
        setup that puts in place the fetch logic to retrieve variable annotations
        whenever any of the dataFetchParameters change */
    async componentDidMount() {
        // Here we chain together a mobx property (dataFetchParameters) to
        // an rxJS observable pipeline to debounce the signal and then
        // use switchMap to create new fetch requests and cancel outstanding ones
        // to finally turn this into a local mobx value again that we subscribe to
        // with an autorun to finally update the dependent properties on this class.
        const varStream = toStream(() => this.dataFetchParameters, true)

        const observable = from(varStream).pipe(
            debounceTime(200), // debounce by 200 MS (this also introduces a min delay of 200ms)
            distinctUntilChanged(isEqual), // don't emit new values if the value hasn't changed
            switchMap((params) => {
                // use switchmap to create a new fetch (as an observable) and
                // automatically cancel stale fetch requests
                return fromFetch(this.buildDataFetchUrl(params), {
                    headers: { Accept: "application/json" },
                    credentials: "same-origin",
                    selector: (response) => response.json(),
                }).pipe(
                    // catch errors and report them the way the admin UI expects it
                    catchError((err: any /*, caught: Observable<any> */) => {
                        this.context.admin.setErrorMessage({
                            title: `Failed to fetch variable annotations`,
                            content:
                                stringifyUnkownError(err) ??
                                "unexpected error value in setErrorMessage",
                            isFatal: false,
                        })
                        return [undefined]
                    })
                )
            })
        )
        // Turn the rxJs observable stream into a mobx value
        const mobxValue = fromStream(observable)
        // Set up the autorun to run an action to update the dependendencies
        const disposer = autorun(() => {
            const currentData = mobxValue.current

            if (currentData !== undefined) {
                runInAction(() => {
                    this.resetViewStateAfterFetch()
                    this.currentPagingOffset = this.desiredPagingOffset
                    this.richDataRows = currentData.variables.map(
                        parseVariableAnnotationsRow
                    )
                    this.numTotalRows = currentData.numTotalRows
                })
            }
        })
        // Add the disposer to the list of things we need to clean up on unmount
        this.disposers.push(disposer)

        this.getFieldDefinitions()
    }

    @action.bound private resetViewStateAfterFetch(): void {
        this.undoStack = []
        this.redoStack = []
        this.selectedRow = undefined
        this.grapherElement = undefined
    }
    @action.bound private loadGrapherJson(json: any): void {
        const newConfig: GrapherProgrammaticInterface = {
            ...json,
            bounds: new Bounds(0, 0, 500, 400),
            getGrapherInstance: (grapher: Grapher) => {
                this.grapher = grapher
            },
        }
        if (this.grapherElement) {
            this.grapher.setAuthoredVersion(newConfig)
            this.grapher.reset()
            this.grapher.updateFromObject(newConfig)
            this.grapher.downloadData()
        } else this.grapherElement = <Grapher {...newConfig} />
    }

    @action private updatePreviewToRow(row: number): void {
        const { richDataRows } = this
        if (richDataRows === undefined) return

        // Get the grapherConfig of the currently selected row and then
        // merge it with the necessary partial information (e.g. variableId field)
        // to get a config that actually works in all cases
        const config = richDataRows[row].grapherConfig
        const finalConfigLayer = getFinalConfigLayerForVariable(
            richDataRows[row].id
        )
        const mergedConfig = merge(config, finalConfigLayer)
        this.loadGrapherJson(mergedConfig)
    }

    async sendPatches(patches: VariableAnnotationPatch[]): Promise<void> {
        await this.context.admin.rawRequest(
            "/api/variable-annotations",
            JSON.stringify(patches),
            "PATCH"
        )
    }

    /** Used to send the inverse of a patch to undo a change that has previously been performed
     */
    async sendReversedPatches(
        patches: VariableAnnotationPatch[]
    ): Promise<void> {
        const reversedPatches = patches.map((patch) => ({
            ...patch,
            newValue: patch.oldValue,
            oldValue: patch.newValue,
        }))
        await this.sendPatches(reversedPatches)
    }

    /** Performs an action - i.e. applies it to the richDataRows object,
        sends an HTTP patch request and puts the step onto the undo stack */
    @action
    async doAction(action: Action): Promise<void> {
        const { richDataRows } = this
        if (richDataRows === undefined) return

        this.undoStack.push(action)

        for (const patch of action.patches) {
            const rowId = richDataRows.findIndex(
                (row) => row.id === patch.variableId
            )
            if (rowId === -1)
                console.error("Could not find row id in do step!", rowId)
            else {
                // apply the change to the richDataRows json structure

                richDataRows[rowId].grapherConfig = applyPatch(
                    patch,
                    richDataRows[rowId].grapherConfig
                )
            }
        }
        if (this.selectedRow) this.updatePreviewToRow(this.selectedRow)
        await this.sendPatches(action.patches)
    }

    @action
    async undoAction(): Promise<void> {
        const { undoStack, redoStack } = this
        if (undoStack.length == 0) return
        // TODO: not yet properly implemented - figure out how to update the flat data rows and
        // set them here. Also change the rich data row entries
        const lastStep = undoStack.pop()
        redoStack.push(lastStep!)
        await this.sendReversedPatches(lastStep!.patches)
    }

    @action
    async redoAction(): Promise<void> {
        const { redoStack } = this
        if (redoStack.length == 0) return
        // TODO: not yet properly implemented - figure out how to update the flat data rows and
        // set them here. Also change the rich data row entries
        const lastStep = redoStack.pop()
        this.undoStack.push(lastStep!)
        await this.sendPatches(lastStep!.patches)
    }

    @computed get fieldDescriptionsMap(): Map<string, FieldDescription> {
        const { fieldDescriptions } = this
        const map = new Map<string, FieldDescription>()
        if (fieldDescriptions === undefined) return map
        for (const fieldDescription of fieldDescriptions)
            map.set(fieldDescription.pointer, fieldDescription)
        return map
    }

    @computed get defaultValues(): Record<string, any> {
        const { fieldDescriptions } = this
        if (fieldDescriptions === undefined) return {}
        else {
            const fields = fieldDescriptions
                .filter((field) => field.default !== undefined)
                .map((field) => [field.pointer, field.default!] as const)
            const asObject = fromPairs(fields as any)
            return asObject
        }
    }
    /** This is an array of data values that is derived from the richDataRows
        property. It represents roughly the same logical structure but flattened out
        into an array of records where each key is the id of a column (= the json pointer
        to the place in the grapherConfig this column represents).

        What this function also does is set the default values where we have them in the schema
        (which is basically for boolean values and enums) so that the correct defaults are shown.

        For example, an entry in this array would have some fields like this:
        {
            id: ...,
            name: ...,
            datasetname: ...,
            namespacename: ...,
            /title: ...,
            /subtitle: ...,
            /map/projection: ...,
            ...
        } */
    @computed get flattenedDataRows(): unknown[] | undefined {
        const { richDataRows, fieldDescriptions, defaultValues } = this
        if (richDataRows === undefined || fieldDescriptions === undefined)
            return undefined
        return this.richDataRows?.map((row) => {
            // for every field description try to get the value at this fields json pointer location
            // we cloneDeep it so that the value is independent in any case, even array or (in the future) objects
            // so that the grid will not change these values directly
            const fieldsArray = fieldDescriptions
                .map(
                    (fieldDesc) =>
                        [
                            fieldDesc.pointer,
                            row.grapherConfig != undefined
                                ? cloneDeep(
                                      fieldDesc.getter(
                                          row.grapherConfig as Record<
                                              string,
                                              unknown
                                          >
                                      )
                                  )
                                : undefined,
                        ] as const
                )
                .filter(([, val]) => !isNil(val))
            const fields = fromPairs(fieldsArray as any)
            const readOnlyColumnValues = [
                ...readOnlyColumnNamesFields.values(),
            ].map((field) => [field.key, (row as any)[field.key]])
            const readOnlyValuesObject =
                Object.fromEntries(readOnlyColumnValues)
            return {
                ...readOnlyValuesObject,
                ...defaultValues,
                ...fields,
            }
        })
    }

    static decideHotType(desc: FieldDescription): string {
        // Map the field description editor choice to a handsontable editor.
        // We currently map several special types to text when we don't have anything
        // fancy implemented
        return match(desc.editor)
            .with(EditorOption.checkbox, () => "checkbox")
            .with(EditorOption.dropdown, () => "dropdown")
            .with(EditorOption.numeric, () => "numeric")
            .with(EditorOption.textfield, () => "text")
            .with(EditorOption.textarea, () => "text")
            .with(EditorOption.colorEditor, () => "text")
            .with(EditorOption.mappingEditor, () => "text")
            .with(EditorOption.primitiveListEditor, () => "text")
            .exhaustive()
    }
    static fieldDescriptionToColumn(desc: FieldDescription): JSX.Element {
        const name = desc.pointer //.substring(1)
        return (
            <HotColumn
                key={desc.pointer}
                settings={{
                    title: name,
                    readOnly:
                        desc.editor === EditorOption.primitiveListEditor ||
                        desc.editor === EditorOption.mappingEditor ||
                        desc.editor === EditorOption.colorEditor,
                    type: VariablesAnnotationComponent.decideHotType(desc),
                    source: desc.enumOptions,
                    data: desc.pointer,
                    width: Math.max(Bounds.forText(name).width, 50),
                }}
            />
        )
    }

    @computed get hotColumns(): JSX.Element[] {
        const { fieldDescriptions, columnSelection } = this

        if (fieldDescriptions === undefined || columnSelection.length === 0)
            return []
        else {
            const fieldDescriptionsMap = new Map(
                fieldDescriptions.map((fieldDesc) => [
                    fieldDesc.pointer,
                    fieldDesc,
                ])
            )
            const undefinedColumns: ColumnReorderItem[] = []
            const columns = columnSelection.map((reorderItem) => {
                if (isConfigColumn(reorderItem.key)) {
                    const fieldDesc = fieldDescriptionsMap.get(reorderItem.key)
                    if (fieldDesc === undefined) {
                        undefinedColumns.push(reorderItem)
                        return undefined
                    } else
                        return VariablesAnnotationComponent.fieldDescriptionToColumn(
                            fieldDesc
                        )
                } else {
                    const readonlyField = readOnlyColumnNamesFields.get(
                        reorderItem.key
                    )
                    if (readonlyField === undefined) {
                        undefinedColumns.push(reorderItem)
                        return undefined
                    } else
                        return (
                            <HotColumn
                                key={readonlyField.label}
                                settings={{
                                    title: readonlyField.label,
                                    readOnly: true,
                                    data: readonlyField.key,
                                    width: Math.max(
                                        Bounds.forText(readonlyField.label)
                                            .width,
                                        50
                                    ),
                                }}
                            />
                        )
                }
            })
            const definedColumns = excludeUndefined(columns)
            // If we have columns that we couldn't match, find out which ones they were and console.error them
            if (!isEmpty(undefinedColumns))
                console.error(
                    "Some columns could not be found!",
                    undefinedColumns
                )
            return definedColumns
        }
    }

    @computed
    private get hotSettings() {
        const { flattenedDataRows, columnSelection } = this
        const hiddenColumnIndices = columnSelection.flatMap(
            (reorderItem, index) => (reorderItem.visible ? [] : [index])
        )
        if (flattenedDataRows === undefined) return undefined

        const hotSettings: Handsontable.GridSettings = {
            afterChange: (changes, source) =>
                this.processChangedCells(changes, source),
            beforeChange: (changes, source) =>
                this.validateCellChanges(changes, source),
            afterSelectionEnd: (row /*, column, row2, column2, layer*/) => {
                if (row !== this.selectedRow) {
                    this.selectedRow = row
                    this.updatePreviewToRow(row)
                }
            },
            allowInsertColumn: false,
            allowInsertRow: false,
            autoRowSize: false,
            autoColumnSize: false,
            // cells,
            colHeaders: true,
            comments: false,
            contextMenu: true,
            data: flattenedDataRows as Handsontable.RowObject[],
            height: "100%",
            hiddenColumns: {
                columns: hiddenColumnIndices,
                copyPasteEnabled: false,
            } as any,
            manualColumnResize: true,
            manualColumnFreeze: true,
            manualRowMove: false,
            minCols: 1,
            minSpareCols: 0,
            minRows: 1,
            minSpareRows: 0,
            rowHeaders: true,
            search: false,
            stretchH: "all",
            width: "100%",
            wordWrap: false,
        }

        return hotSettings
    }

    validateCellChanges(
        changes: Handsontable.CellChange[] | null,
        source: Handsontable.ChangeSource
    ): boolean | void {
        const { fieldDescriptionsMap } = this
        // The Handsontable.CellChange is an array of 4 elements: [row, column, oldValue, newValue]. Below
        // we have the indices, only a few of them which are used now
        const columnIndex = 1
        const newValueIndex = 3
        // Changes due to loading are always ok (return flags all as ok)
        if (source === "loadData" || changes === null) return

        // cancel editing if multiple columns are changed at the same time - we
        // currently only support changes to a single column at a time
        const differentColumns = new Set(
            changes.map((change) => change[columnIndex])
        )
        if (differentColumns.size > 1) return false
        const targetColumn = [...differentColumns][0] as string

        const columnDefinition = fieldDescriptionsMap.get(targetColumn)
        if (columnDefinition === undefined) {
            console.error(
                "Could not find column definition when trying to verify"
            )
            return
        }

        // Since we are editing only values in one column, we strongly assume
        // that all values are of the same type (actually supposed to be the same value)
        // -> verify this
        const allChangesSameType = changes.every(
            (change) =>
                typeof change[newValueIndex] ===
                typeof changes[0][newValueIndex]
        )
        if (!allChangesSameType) {
            console.error("Not all changes were of the same type?")
            return
        }

        // Check if the type matches the target (e.g. to avoid a string value ending
        // up in a text field). This is hard to nail down fully but we try to avoid
        // such mistakes where possible.
        const firstNewValue = changes[0][newValueIndex]
        const invalidTypeAssignment = match<
            [FieldType | FieldType[], string],
            boolean
        >([columnDefinition.type, typeof firstNewValue])
            .with([FieldType.string, "string"], () => false)
            .with([FieldType.number, "string"], () =>
                Number.isNaN(Number.parseFloat(firstNewValue))
            )
            .with([FieldType.integer, "string"], () =>
                Number.isNaN(Number.parseInt(firstNewValue))
            )
            .with([FieldType.boolean, "boolean"], () => false)
            .with([[__], "string"], () => false)

            .otherwise(() => true)
        if (invalidTypeAssignment) return false

        // TODO: locally apply values here and see if they parse the schema? Might be an easy
        // highlevel way to verify that enums are obeyed etc. But might also be tricky to debug
        // if validation fails for nonobvious reasons

        // If we got here then everything seems to be ok
        return
    }

    processChangedCells(
        changes: Handsontable.CellChange[] | null,
        source: Handsontable.ChangeSource
    ): void {
        // We don't want to persist changes due to loading data
        const { fieldDescriptionsMap, richDataRows } = this
        if (
            source === "loadData" ||
            changes === null ||
            richDataRows === undefined
        )
            return

        const patches = []
        // Collect the patches, which is a data structure of row, column, oldValue, newValue
        for (const change of changes) {
            let [rowIndex, column, prevVal, newVal] = change

            const fieldDesc = fieldDescriptionsMap.get(column as string)
            const row = richDataRows[rowIndex]

            // we normalize the default values to null (we don't want to store them and null leads to removing the key)
            if (
                fieldDesc?.default !== undefined &&
                prevVal === fieldDesc?.default
            )
                prevVal = null
            if (
                fieldDesc?.default !== undefined &&
                newVal === fieldDesc?.default
            )
                newVal = null

            // Type conversion
            // If we have an array of both strings and number then the value we get here will always
            // be a string. Check if we can coerce it to number and do so if possible
            if (
                isArray(fieldDesc?.type) &&
                fieldDesc?.type.find(
                    (type) =>
                        type === FieldType.number || type === FieldType.integer
                ) &&
                !Number.isNaN(Number.parseFloat(newVal))
            )
                newVal = Number.parseFloat(newVal)

            // Now construct the patch and store it
            const patch: VariableAnnotationPatch = {
                variableId: row.id,
                oldValue: prevVal,
                newValue: newVal,
                jsonPointer: column as string,
            }
            patches.push(patch)
        }
        // Perform a do operation that will add this to the undo stack and immediately
        // post this as a PATCH request to the server
        this.doAction({ patches })
    }

    async getFieldDefinitions() {
        // TODO: this should switch to files.ourwordindata.org but if I do this I get a CORS error -
        // areh HEAD requests not forwarded?
        const json = await fetch(
            "https://owid.nyc3.digitaloceanspaces.com/schemas/grapher-schema.001.json"
        ).then((response) => response.json())
        const fieldDescriptions = extractFieldDescriptionsFromSchema(json)
        runInAction(() => {
            this.fieldDescriptions = fieldDescriptions

            this.initializeColumnSelection(
                fieldDescriptions,
                this.currentColumnSet
            )
            this.filterState = {
                tree: QbUtils.checkTree(
                    QbUtils.loadTree(initialFilterQueryValue),
                    this.FilterPanelConfig ?? filterPanelInitialConfig
                ),
                config: this.FilterPanelConfig ?? filterPanelInitialConfig,
            }
        })
    }

    @action
    initializeColumnSelection(
        fieldDescriptions: FieldDescription[] | undefined,
        currentColumnSet: ColumnSet
    ) {
        if (fieldDescriptions === undefined) return
        // Now we need to construct the initial order and visibility state of all ColumnReorderItems
        // First construct them from the fieldDescriptions (from the schema) and the hardcoded readonly column names
        const fieldDescReorderItems: ColumnReorderItem[] = fieldDescriptions
            .filter((fieldDesc) => !HIDDEN_COLUMNS.has(fieldDesc.pointer))
            .map((item) => ({
                key: item.pointer,
                visible: false,
                description: item.description,
            }))
        const readonlyReorderItems: ColumnReorderItem[] = [
            ...readOnlyColumnNamesFields.values(),
        ].map(({ label, key }) => ({
            key: key,
            visible: false,
            description: label,
        }))
        // Construct a few helpers
        const allReorderItems = readonlyReorderItems.concat(
            fieldDescReorderItems
        )
        const reorderItemsMap = new Map(
            allReorderItems.map((item) => [item.key, item])
        )
        // Now check what is selected in currentColumnSet. If we should just show all then create that sequence,
        // otherwise use the list of column ids that we are supposed to show in this order with visible true
        const columnFieldIdsToMakeVisibleAndShowFirst = match(currentColumnSet)
            .with({ kind: "allColumns" }, () =>
                allReorderItems.map((item) => item.key)
            )
            .with(
                { kind: "specificColumns" },
                (specificColumns) => specificColumns.columns
            )
            .exhaustive()

        // Now construct the final reorderItems array that is in the right order and has visible set
        // to true where appropriate
        const reorderItems = []

        for (const fieldId of columnFieldIdsToMakeVisibleAndShowFirst) {
            const item = reorderItemsMap.get(fieldId)!
            item.visible = true
            reorderItems.push(item)
        }
        const itemsAlreadyInserted = new Set(
            reorderItems.map((item) => item.key)
        )
        for (const field of allReorderItems) {
            if (!itemsAlreadyInserted.has(field.key)) {
                reorderItems.push(field)
            }
        }

        this.columnSelection = reorderItems
    }

    render() {
        const { hotSettings, hotColumns, activeTab } = this
        if (hotSettings === undefined) return <div>Loading</div>
        else
            return (
                <div className="VariablesAnnotationPage">
                    <div className="sidebar">
                        <div className="p-2">
                            <ul className="nav nav-tabs">
                                {ALL_TABS.map((tab) => (
                                    <li key={tab} className="nav-item">
                                        <a
                                            className={
                                                "nav-link" +
                                                (tab === activeTab
                                                    ? " active"
                                                    : "")
                                            }
                                            onClick={action(
                                                () => (this.activeTab = tab)
                                            )}
                                        >
                                            {tab}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="sidebar-content">
                            {match(activeTab)
                                .with(Tabs.FilterTab, () =>
                                    this.renderFilterTab()
                                )
                                .with(Tabs.ColumnsTab, () =>
                                    this.renderColumnsTab()
                                )
                                .otherwise(() => null)}
                            {this.renderPreviewArea()}
                        </div>
                    </div>
                    <div className="editor-view">
                        <HotTable
                            settings={this.hotSettings}
                            //ref={this.hotTableComponent as any}
                            licenseKey={"non-commercial-and-evaluation"}
                        >
                            {hotColumns}
                        </HotTable>
                    </div>
                </div>
            )
    }

    @action.bound
    pageToPreviousPage(): void {
        if (
            (this.numTotalRows ?? 0) > PAGEING_SIZE &&
            this.desiredPagingOffset >= PAGEING_SIZE
        )
            this.desiredPagingOffset = this.desiredPagingOffset - PAGEING_SIZE
    }

    @action.bound
    pageToNextPage(): void {
        if (
            (this.numTotalRows ?? 0) > PAGEING_SIZE &&
            this.desiredPagingOffset + PAGEING_SIZE < (this.numTotalRows ?? 0)
        ) {
            this.desiredPagingOffset = this.desiredPagingOffset + PAGEING_SIZE
        }
    }

    renderPagination(): JSX.Element {
        const { numTotalRows, currentPagingOffset } = this
        const currentStartLabel = currentPagingOffset + 1
        const currentEndLabel = Math.min(
            currentPagingOffset + PAGEING_SIZE,
            numTotalRows ?? 0
        )

        return (
            <nav aria-label="Variable annotation pagination controls">
                <ul className="pagination">
                    <li className="page-item">
                        <a
                            className="page-link"
                            href="#"
                            aria-label="Previous"
                            onClick={this.pageToPreviousPage}
                        >
                            <span aria-hidden="true">&laquo;</span>
                        </a>
                    </li>
                    <li className="page-item">
                        <a className="page-link">
                            {currentStartLabel} to {currentEndLabel} of{" "}
                            {numTotalRows}
                        </a>
                    </li>
                    <li className="page-item">
                        <a
                            className="page-link"
                            href="#"
                            aria-label="Next"
                            onClick={this.pageToNextPage}
                        >
                            <span aria-hidden="true">&raquo;</span>
                        </a>
                    </li>
                </ul>
            </nav>
        )
    }

    renderFilterTab(): JSX.Element {
        const { filterSExpression, FilterPanelConfig, filterState } = this
        return (
            <section>
                <div className="container">
                    <h3>Variable filters</h3>
                    {this.renderPagination()}
                    <BindString
                        field="variableNameFilter"
                        store={this}
                        label="Variable name"
                    />
                    <BindString
                        field="datasetNameFilter"
                        store={this}
                        label="Dataset name"
                    />
                    {FilterPanelConfig && filterState && (
                        <Query
                            {...FilterPanelConfig}
                            value={filterState.tree}
                            onChange={this.updateFilterState}
                            renderBuilder={this.renderBuilder}
                        />
                    )}
                    <div>{filterSExpression?.toSExpr()}</div>
                </div>
            </section>
        )
    }

    @action
    onDragEnd(result: DropResult) {
        if (!result.destination) return
        const newColumnSelection = moveArrayItemToIndex(
            this.columnSelection,
            result.source.index,
            result.destination.index
        )
        this.columnSelection = newColumnSelection
    }

    @action.bound
    columnListEyeIconClicked(
        columnSelection: ColumnReorderItem[],
        itemKey: string,
        newState: boolean
    ) {
        // Set the state of the targeted item and if it becomes visible and it is after
        // what was previously the last visible item then move it to after the last currently visible item
        // so that it is easier to find in the list
        const itemIndex = columnSelection.findIndex(
            (item) => item.key === itemKey
        )
        if (itemIndex !== -1) {
            const lastVisibleIndex = findLastIndex(
                columnSelection,
                (item) => item.visible
            )

            let copy = [...columnSelection]
            copy[itemIndex].visible = newState
            if (newState && itemIndex > lastVisibleIndex) {
                const targetIndex = lastVisibleIndex + 1
                copy = moveArrayItemToIndex(copy, itemIndex, targetIndex)
            }

            this.columnSelection = copy
        }
    }

    @action.bound
    setCurrentColumnSet(label: string) {
        this.currentColumnSet =
            columnSets.find((item) => item.label === label) ?? columnSets[0]
        this.initializeColumnSelection(
            this.fieldDescriptions,
            this.currentColumnSet
        )
    }

    @action.bound
    clearColumnFilter() {
        this.columnFilter = ""
    }

    renderColumnsTab(): JSX.Element {
        const { columnSelection, currentColumnSet, columnFilter } = this
        const filteredColumnSelection = columnFilter
            ? columnSelection.filter((column) =>
                  column.key.toLowerCase().includes(columnFilter.toLowerCase())
              )
            : columnSelection
        return (
            <section className="column-section">
                <div className="container">
                    <h3>Columns</h3>
                    <SelectField
                        label="Column set"
                        value={currentColumnSet.label}
                        onValue={this.setCurrentColumnSet}
                        options={columnSets.map((item) => ({
                            value: item.label,
                            label: item.label,
                        }))}
                    />
                    <BindString
                        field="columnFilter"
                        store={this}
                        label="Filter columns"
                        buttonText="Clear"
                        onButtonClick={this.clearColumnFilter}
                    />

                    <DragDropContext
                        onDragEnd={(result) => this.onDragEnd(result)}
                    >
                        <Droppable droppableId="droppable">
                            {(provided /*, snapshot */) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                >
                                    {filteredColumnSelection.map(
                                        (item, index) => (
                                            <Draggable
                                                key={item.key}
                                                draggableId={item.key}
                                                index={index}
                                            >
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        style={getItemStyle(
                                                            snapshot.isDragging,
                                                            provided
                                                                .draggableProps
                                                                .style
                                                        )}
                                                        className="column-list-item"
                                                    >
                                                        <div
                                                            title={
                                                                item.description
                                                            }
                                                        >
                                                            <IconToggleComponent
                                                                isOn={
                                                                    item.visible
                                                                }
                                                                onIcon={faEye}
                                                                offIcon={
                                                                    faEyeSlash
                                                                }
                                                                onClick={(
                                                                    newState
                                                                ) =>
                                                                    this.columnListEyeIconClicked(
                                                                        this
                                                                            .columnSelection,
                                                                        item.key,
                                                                        newState
                                                                    )
                                                                }
                                                            />
                                                            {item.key}
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        )
                                    )}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>
            </section>
        )
    }

    renderPreviewArea(): JSX.Element {
        const { grapherElement } = this
        return (
            <div className="preview">
                <h3>Interactive grapher preview</h3>
                {grapherElement ? grapherElement : null}
            </div>
        )
    }

    buildDataFetchUrl(fetchParameters: FetchVariablesParameters): string {
        const filter =
            fetchVariablesParametersToQueryParametersString(fetchParameters)
        const baseUrl = "/admin/api/variable-annotations"
        return baseUrl + filter
    }

    componentWillUnmount() {
        for (const disposer of this.disposers) {
            disposer()
        }
        this.disposers = []
    }
    @observable.ref filterState: FilterPanelState | undefined = undefined

    @action.bound
    updateFilterState(immutableTree: ImmutableTree, config: Config) {
        const { filterState } = this

        const updateFilterState = !(
            isEqual(filterState?.tree, immutableTree) &&
            isEqual(filterState?.config, config)
        )

        if (updateFilterState)
            this.filterState = {
                ...filterState,
                tree: immutableTree,
                config: config,
            }

        const jsonTree = QbUtils.getTree(immutableTree)
        console.log("jsonTree", jsonTree)
    }

    @computed get filterSExpression(): Operation | undefined {
        const { filterState } = this
        if (filterState) {
            const tree = QbUtils.getTree(filterState.tree)
            const sExpression = filterTreeToSExpression(tree)
            console.log("Recomputing filterSExpression", sExpression)

            return sExpression
        }
        return undefined
    }

    renderBuilder = (props: BuilderProps) => (
        <div className="query-builder-container" style={{ padding: "0" }}>
            <div className="query-builder qb-lite">
                <Builder {...props} />
            </div>
        </div>
    )

    @computed get filterPanelConfigFields(): [string, SimpleField][] {
        const { columnSelection, fieldDescriptions } = this
        // The schema of some fields is an anyOf which is used to model fields like maxTime that are usually numeric but can also
        // have the value "latest". These are then transformed into a type entry that is a string of the involved types (in this case
        // number and string). For now we just select the first type here but we might have to be more clever in the future and build
        // a custom field type for such cases that allows both numeric and string equals queries

        if (fieldDescriptions === undefined) return []
        const fieldDescriptionMap = new Map(
            fieldDescriptions.map((fd) => [fd.pointer, fd])
        )
        const fields = excludeUndefined(
            columnSelection.map((column) => {
                if (isConfigColumn(column.key)) {
                    return fieldDescriptionToFilterPanelFieldConfig(
                        fieldDescriptionMap.get(column.key)!
                    )
                } else {
                    return simpleColumnToFilterPanelFieldConfig(
                        readOnlyColumnNamesFields.get(column.key)!
                    )
                }
            })
        )
        return fields
    }

    @computed get FilterPanelConfig(): Config | undefined {
        const { filterPanelConfigFields } = this

        if (isEmpty(filterPanelConfigFields)) return undefined

        const fieldsObject = Object.fromEntries(filterPanelConfigFields)
        return {
            ...filterPanelInitialConfig,
            fields: fieldsObject,
        }
    }
}

function simpleColumnToFilterPanelFieldConfig(
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

function fieldDescriptionToFilterPanelFieldConfig(
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

export class VariablesAnnotationPage extends React.Component {
    render() {
        return (
            <AdminLayout title="Variables">
                <main className="VariablesAnnotationPage">
                    <VariablesAnnotationComponent />
                </main>
            </AdminLayout>
        )
    }

    //dispose!: IReactionDisposer
}
function getFinalConfigLayerForVariable(id: number) {
    return {
        version: 1,
        dimensions: [{ property: "y", variableId: id }],
        map: {
            variableId: id,
        },
    }
}
