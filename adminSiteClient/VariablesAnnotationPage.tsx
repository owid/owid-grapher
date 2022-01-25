import * as React from "react"
import { Disposer, observer } from "mobx-react"
import { observable, computed, action, runInAction, autorun } from "mobx"
import { match, __ } from "ts-pattern"
//import * as lodash from "lodash"
import _, { cloneDeep, fromPairs, isArray, isEqual, isNil, merge } from "lodash"

import jsonpointer from "json8-pointer"
import { HotColumn, HotTable } from "@handsontable/react"
import { AdminLayout } from "./AdminLayout"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { applyPatch } from "../clientUtils/patchHelper"
import {
    BinaryLogicOperation,
    BinaryLogicOperators,
    BooleanAtom,
    BooleanOperation,
    Operation,
    SqlColumnName,
    SQL_COLUMN_NAME_DATASET_NAME,
    SQL_COLUMN_NAME_VARIABLE_NAME,
    StringAtom,
    StringContainsOperation,
    StringOperation,
} from "../clientUtils/SqlFilterSExpression"
import {
    FieldDescription,
    extractFieldDescriptionsFromSchema,
    FieldType,
    EditorOption,
} from "../clientUtils/schemaProcessing"

import Handsontable from "handsontable"
import { GrapherInterface } from "../grapher/core/GrapherInterface"
import { Bounds } from "../clientUtils/Bounds"
import {
    VariableAnnotationsResponseRow,
    VariableAnnotationsResponse,
    VariableAnnotationPatch,
} from "../clientUtils/AdminSessionTypes"
import { Grapher, GrapherProgrammaticInterface } from "../grapher/core/Grapher"
import { BindString } from "./Forms"
import { from, Observable, ObservableInput } from "rxjs"
import {
    catchError,
    combineAll,
    debounceTime,
    distinctUntilChanged,
    switchMap,
} from "rxjs/operators"
import { fromFetch } from "rxjs/fetch"
import { toStream, fromStream, IStreamListener } from "mobx-utils"
import {
    stringifyUnkownError,
    differenceOfSets,
    excludeUndefined,
} from "../clientUtils/Util"
import { queryParamsToStr } from "../clientUtils/urls/UrlUtils"

function parseVariableAnnotationsRow(
    row: VariableAnnotationsResponseRow
): VariableAnnotationsRow {
    return row as VariableAnnotationsRow // The type defintiion of VariableAnnotationsResponseRow in clientUtils can't use GrapherInterface so we type cast here for now
}

interface VariableAnnotationsRow {
    id: number
    name: string
    grapherConfig: GrapherInterface
    datasetname: string
    namespacename: string
}

interface Action {
    patches: VariableAnnotationPatch[]
}

const PAGEING_SIZE: number = 50
enum Tabs {
    EditorTab = "EditorTab",
    FilterTab = "FilterTab",
}

const ALL_TABS = Object.values(Tabs)

const HIDDEN_COLUMNS = [
    "/$schema",
    "/id",
    "/map/variableId",
    "/version",
    "/dimensions/0/variableId",
    "/dimensions/0/property",
    "/slug",
    "/data",
]

const IMPORTANT_COLUMNS = [
    "/type",
    "/hasMapTab",
    "/title",
    "/subtitle",
    "/note",
    "/dimensions/0/unit",
    "/dimensions/0/shortUnit",
]

/** All the parameters we need for making a fully specified request to the /variable-annotations
    endpoint. When any of these fields change we need to trigger a new request */
interface FetchVariablesParameters {
    pagingOffset: number
    filterQuery: Operation
    sortByColumn: string // sort is currently ignored but here for future use
    sortByAscending: boolean // sort is currently ignored but here for future use
}

function fetchVariablesParametersToQueryParametersString(
    params: FetchVariablesParameters
): string {
    return queryParamsToStr({
        filter: params.filterQuery.toSExpr(),
        offset: params.pagingOffset.toString(),
    })
}

/** Turns a search string like "nuclear share" into a BooleanOperation
    that AND connects a CONTAINS query for every word - i.e. it would result in
    (AND (CONTAINS target "nuclear") (CONTAINS target "share"))  */
function searchFieldStringToFilterOperations(
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

@observer
class VariablesAnnotationComponent extends React.Component {
    static contextType = AdminAppContext

    @observable.ref grapher = new Grapher() // the grapher instance we keep around and update
    @observable.ref grapherElement?: JSX.Element // the JSX Element of the preview IF we want to display it currently
    numTotalRows: number | undefined = undefined
    selectedRow: number | undefined = undefined
    @observable activeTab = Tabs.FilterTab

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
        } = this
        const filterOperations = excludeUndefined([
            searchFieldStringToFilterOperations(
                variableNameFilter ?? "",
                new SqlColumnName(SQL_COLUMN_NAME_VARIABLE_NAME)
            ),
            searchFieldStringToFilterOperations(
                datasetNameFilter ?? "",
                new SqlColumnName(SQL_COLUMN_NAME_DATASET_NAME)
            ),
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
                    catchError((err: any, caught: Observable<any>) => {
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
                    console.log("Data fetched", currentData)
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
        console.log("updating preview to row", row)
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
                .filter(([name, val]) => !isNil(val))
            const fields = fromPairs(fieldsArray as any)
            return {
                id: row.id,
                name: row.name,
                datasetname: row.datasetname,
                namespacename: row.namespacename,
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
            .with(EditorOption.checkbox, (_) => "checkbox")
            .with(EditorOption.dropdown, (_) => "dropdown")
            .with(EditorOption.numeric, (_) => "numeric")
            .with(EditorOption.textfield, (_) => "text")
            .with(EditorOption.textarea, (_) => "text")
            .with(EditorOption.colorEditor, (_) => "text")
            .with(EditorOption.mappingEditor, (_) => "text")
            .with(EditorOption.primitiveListEditor, (_) => "text")
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
    static readOnlyColumnNamesFields = [
        ["Id", "id"],
        ["Variable name", "name"],
        ["Dataset name", "datasetname"],
        ["Namespace", "namespacename"],
    ] as const

    @computed get hotColumns(): JSX.Element[] {
        const { fieldDescriptions } = this

        if (fieldDescriptions === undefined) return []
        else {
            // First the 4 readonly columns
            const readOnlyColumns: JSX.Element[] =
                VariablesAnnotationComponent.readOnlyColumnNamesFields.map(
                    (nameAndField) => (
                        <HotColumn
                            key={nameAndField[0]}
                            settings={{
                                title: nameAndField[0],
                                readOnly: true,
                                data: nameAndField[1],
                                width: Math.max(
                                    Bounds.forText(nameAndField[0]).width,
                                    50
                                ),
                            }}
                        />
                    )
                )
            // then all the others coming from the fieldDescriptions
            // for these we want to suppress the HIDDEN_COLUMNS and
            // move the IMPORTANT_COLUMNS to the front
            const fieldDescsMap = new Map(
                fieldDescriptions.map((desc) => [desc.pointer, desc])
            )
            const importantDescs = IMPORTANT_COLUMNS.map((pointer) =>
                fieldDescsMap.get(pointer)
            )
            const remainingDescs = differenceOfSets([
                new Set(fieldDescsMap.keys()),
                new Set(IMPORTANT_COLUMNS),
                new Set(HIDDEN_COLUMNS),
            ])
            const fieldDescsFilteredAndPrioritized = [
                ...importantDescs,
                ...fieldDescriptions.filter((item) =>
                    remainingDescs.has(item.pointer)
                ),
            ]
            if (
                fieldDescsFilteredAndPrioritized.some(
                    (item) => item === undefined
                )
            )
                console.error(
                    "Some fields were undefined! Check if all IMPORTANT_COLUMNS actually appear in the schema."
                )
            const grapherColumns = fieldDescsFilteredAndPrioritized
                .filter((item) => item !== undefined)
                .map((item) =>
                    VariablesAnnotationComponent.fieldDescriptionToColumn(item!)
                )
            return [...readOnlyColumns, ...grapherColumns]
        }
    }

    @computed
    private get hotSettings() {
        const { flattenedDataRows } = this
        if (flattenedDataRows === undefined) return undefined

        const hotSettings: Handsontable.GridSettings = {
            afterChange: (changes, source) =>
                this.processChangedCells(changes, source),
            beforeChange: (changes, source) =>
                this.validateCellChanges(changes, source),
            afterSelectionEnd: (row, column, row2, column2, layer) => {
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
            comments: true,
            data: flattenedDataRows as Handsontable.RowObject[],
            height: "100%",
            manualColumnResize: true,
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
        const rowIndex = 0
        const columnIndex = 1
        const oldValueIndex = 2
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
            .with([FieldType.string, "string"], (_) => false)
            .with([FieldType.number, "string"], (_) =>
                Number.isNaN(Number.parseFloat(firstNewValue))
            )
            .with([FieldType.integer, "string"], (_) =>
                Number.isNaN(Number.parseInt(firstNewValue))
            )
            .with([FieldType.boolean, "boolean"], (_) => false)
            .with([[__], "string"], (_) => false)

            .otherwise((_) => true)
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

            const targetPath = jsonpointer.parse(column) as string[]
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
            console.log("fielddescription set", this.fieldDescriptions)
        })
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
                            {activeTab === Tabs.FilterTab
                                ? this.renderFilterTab()
                                : null}
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
            console.log("increasing desired paging offset")
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
                            {currentStartLabe} to {currentEndLabel} of{" "}
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
