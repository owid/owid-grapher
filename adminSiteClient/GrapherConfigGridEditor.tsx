import * as _ from "lodash-es"
import * as React from "react"
import {
    Bounds,
    stringifyUnknownError,
    excludeUndefined,
    moveArrayItemToIndex,
    getWindowUrl,
    setWindowUrl,
    excludeNull,
    mergeGrapherConfigs,
} from "@ourworldindata/utils"
import { GrapherConfigPatch } from "../adminShared/AdminSessionTypes.js"
import {
    applyPatch,
    setValueRecursiveInplace,
} from "../adminShared/patchHelper.js"
import {
    FieldDescription,
    extractFieldDescriptionsFromSchema,
    FieldType,
    EditorOption,
} from "../adminShared/schemaProcessing.js"
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from "react-beautiful-dnd"
import { Disposer, observer } from "mobx-react"
import {
    observable,
    computed,
    action,
    runInAction,
    autorun,
    reaction,
} from "mobx"
import { match, P } from "ts-pattern"

import { BaseEditorComponent, HotColumn, HotTable } from "@handsontable/react"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

import Handsontable from "handsontable"
import { GRAPHER_CHART_TYPES, GRAPHER_MAP_TYPE } from "@ourworldindata/types"
import {
    fetchInputTableForConfig,
    Grapher,
    GrapherProgrammaticInterface,
    GrapherState,
    loadVariableDataAndMetadata,
    MapChart,
} from "@ourworldindata/grapher"
import { BindString, SelectField, Toggle } from "./Forms.js"
import { Observable } from "rxjs"
import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    switchMap,
} from "rxjs/operators"
import { fromFetch } from "rxjs/fetch"
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons"
import {
    parseVariableAnnotationsRow,
    VariableAnnotationsRow,
    ColumnInformation,
    Action,
    PAGEING_SIZE,
    Tabs,
    ALL_TABS,
    ColumnSet,
    FetchVariablesParameters,
    fetchVariablesParametersToQueryParametersString,
    IconToggleComponent,
    getItemStyle,
    isConfigColumn,
    filterTreeToSExpression,
    FilterPanelState,
    filterPanelInitialConfig,
    initialFilterQueryValue,
    fieldDescriptionToFilterPanelFieldConfig,
    simpleColumnToFilterPanelFieldConfig,
    GrapherConfigGridEditorProps,
    GrapherConfigGridEditorConfig,
    ColumnDataSource,
    ColumnDataSourceType,
    ColumnDataSourceUnknown,
    SExpressionToJsonLogic,
    fetchVariablesParametersFromQueryString,
    filterExpressionNoFilter,
    fetchVariablesParametersToQueryParameters,
    postprocessJsonLogicTree,
} from "./GrapherConfigGridEditorTypesAndUtils.js"
import QueryBuilderContainer from "./QueryBuilderContainer.js"
import {
    Query,
    Utils as QbUtils,
    Utils,
    SimpleField,
    Config,
    ImmutableTree,
} from "@react-awesome-query-builder/antd"
import codemirror from "codemirror"
import { UnControlled as CodeMirror } from "react-codemirror2"
import jsonpointer from "json8-pointer"
import { EditorColorScaleSection } from "./EditorColorScaleSection.js"
import { Operation } from "../adminShared/SqlFilterSExpression.js"
import { DATA_API_URL } from "../settings/clientSettings.js"

// The rule doesn't support class components in the same file.
// eslint-disable-next-line react-refresh/only-export-components
function HotColorScaleRenderer() {
    return <div style={{ color: "gray" }}>Color scale</div>
}
/**
 * This cell editor component explicitly does nothing. It is used for color scale columns
 * where we don't want to make the cells read only so that copy/paste etc still work but
 * at the same time we don't want the user to be able to edit the cells directly (instead
 * they should use the sidebar editor)
 */
class HotColorScaleEditor extends BaseEditorComponent<any> {
    constructor(props: Record<string, never>) {
        super(props)
    }

    getValue() {
        return undefined
    }

    prepare(
        row: any,
        col: any,
        prop: any,
        td: any,
        originalValue: any,
        cellProperties: any
    ) {
        // We'll need to call the `prepare` method from
        // the `BaseEditorComponent` class, as it provides
        // the component with the information needed to use the editor
        // (hotInstance, row, col, prop, TD, originalValue, cellProperties)
        super.prepare(row, col, prop, td, originalValue, cellProperties)

        // const tdPosition = td.getBoundingClientRect();

        // As the `prepare` method is triggered after selecting
        // any cell, we're updating the styles for the editor element,
        // so it shows up in the correct position.
    }

    render() {
        return <div id="colorScaleEditorElement"></div>
    }
}

@observer
export class GrapherConfigGridEditor extends React.Component<GrapherConfigGridEditorProps> {
    static contextType = AdminAppContext

    @observable.ref grapherState = new GrapherState({
        additionalDataLoaderFn: (varId: number) =>
            loadVariableDataAndMetadata(varId, DATA_API_URL),
    }) // the grapher instance we keep around and update
    numTotalRows: number | undefined = undefined
    @observable selectedRow: number | undefined = undefined
    @observable selectionEndRow: number | undefined = undefined
    @observable selectedColumn: number | undefined = undefined
    @observable selectionEndColumn: number | undefined = undefined
    @observable activeTab = Tabs.FilterTab
    @observable currentColumnSet: ColumnSet
    @observable columnFilter: string = ""
    @observable hasUncommitedRichEditorChanges: boolean = false

    @observable.ref columnSelection: ColumnInformation[] = []
    @observable.ref filterState: FilterPanelState | undefined = undefined

    context!: AdminAppContextType
    /** This array contains a description for every column, information like which field
        to display, what editor control should be used, ... */
    @observable.ref fieldDescriptions: FieldDescription[] | undefined =
        undefined

    /** Rows of the query result to the /variable-annotations endpoint that include a parsed
        grapher object for the grapherConfig field */
    @observable richDataRows: VariableAnnotationsRow[] | undefined = undefined

    /** Undo stack - not yet used - TODO: implement Undo/redo */
    @observable undoStack: Action[] = []
    /** Redo stack - not yet used */
    @observable redoStack: Action[] = []

    @observable keepEntitySelectionOnChartChange: boolean = false
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
    readonly config: GrapherConfigGridEditorConfig
    disposers: Disposer[] = []

    constructor(props: GrapherConfigGridEditorProps) {
        super(props)
        this.config = props.config
        this.currentColumnSet = this.config.columnSet[0]
    }

    /** Computed property that combines all relevant filter, paging and offset
        properties into a FetchVariablesParameter object that is used to construct
        the query */
    @computed get dataFetchParameters(): FetchVariablesParameters {
        const {
            desiredPagingOffset,
            sortByAscending,
            sortByColumn,
            filterSExpression,
            numTotalRows,
        } = this
        const filterQuery = filterSExpression ?? filterExpressionNoFilter
        const offsetToUse = numTotalRows
            ? Math.max(
                  0,
                  Math.min(desiredPagingOffset / 50, numTotalRows / 50 - 1)
              ) * 50
            : desiredPagingOffset
        return {
            offset: offsetToUse,
            filterQuery,
            sortByColumn,
            sortByAscending,
        }
    }
    /** Here is some of the most important code in this component - the
        setup that puts in place the fetch logic to retrieve variable annotations
        whenever any of the dataFetchParameters change */
    async componentDidMount() {
        // Here we convert a mobx property (dataFetchParameters) to an rxJS observable, and define a pipeline to
        // debounce the signal and then use switchMap to create new fetch requests and cancel outstanding ones to
        // finally subscribe to this observable and update the dependent properties on this class.
        const dataFetchParametersObservable =
            new Observable<FetchVariablesParameters>((subscriber) =>
                reaction(
                    () => this.dataFetchParameters, // this is a mobx observable
                    (params) => subscriber.next(params),
                    { fireImmediately: true }
                )
            )

        const fetchDataObservable = dataFetchParametersObservable.pipe(
            debounceTime(200), // debounce by 200 MS (this also introduces a min delay of 200ms)
            distinctUntilChanged(_.isEqual), // don't emit new values if the value hasn't changed
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
                            title: `Failed to fetch indicator annotations`,
                            content:
                                stringifyUnknownError(err) ??
                                "unexpected error value in setErrorMessage",
                            isFatal: false,
                        })
                        return [undefined]
                    })
                )
            })
        )

        // Set up the subscriber to run an action to update the dependencies
        const subscription = fetchDataObservable.subscribe((currentData) => {
            if (currentData !== undefined) {
                runInAction(() => {
                    this.resetViewStateAfterFetch()
                    this.currentPagingOffset = this.desiredPagingOffset
                    this.richDataRows = currentData.rows.map(
                        parseVariableAnnotationsRow
                    )
                    this.numTotalRows = currentData.numTotalRows
                })
            }
        })
        // Add the disposer to the list of things we need to clean up on unmount
        this.disposers.push(() => subscription.unsubscribe())

        void this.getFieldDefinitions()
    }

    @action.bound private resetViewStateAfterFetch(): void {
        this.undoStack = []
        this.redoStack = []
        this.selectedRow = undefined
    }
    @action.bound private async loadGrapherJson(json: any): Promise<void> {
        const newConfig: GrapherProgrammaticInterface = {
            ...json,
            isEmbeddedInAnOwidPage: true,
            bounds: new Bounds(0, 0, 480, 500),
            dataApiUrlForAdmin:
                this.context.admin.settings.DATA_API_FOR_ADMIN_UI, // passed this way because clientSettings are baked and need a recompile to be updated
        }
        this.grapherState.setAuthoredVersion(newConfig)
        this.grapherState.reset()
        if (!this.keepEntitySelectionOnChartChange)
            // this resets the entity selection to what the author set in the chart config
            // This is user controlled because when working with existing charts this is usually desired
            // but when working on the variable level where this is missing it is often nicer to keep
            // the same country selection as you zap through the variables
            this.grapherState.clearSelection()
        this.grapherState.updateFromObject(newConfig)
        const inputTable = await fetchInputTableForConfig(
            newConfig.dimensions ?? [],
            newConfig.selectedEntityColors,
            this.context.admin.settings.DATA_API_FOR_ADMIN_UI || DATA_API_URL,
            undefined
        )
        if (inputTable) this.grapherState.inputTable = inputTable
    }

    @action private async updatePreviewToRow(): Promise<void> {
        const { selectedRowContent } = this
        if (selectedRowContent === undefined) return

        // Get the grapherConfig of the currently selected row and then
        // merge it with the necessary partial information (e.g. variableId field)
        // to get a config that actually works in all cases
        const grapherConfig = selectedRowContent.config
        const finalConfigLayer = this.config.finalVariableLayerModificationFn(
            selectedRowContent.id
        )

        const mergedConfig = mergeGrapherConfigs(
            grapherConfig,
            finalConfigLayer
        )
        void this.loadGrapherJson(mergedConfig)
    }

    @computed private get columnDataSource(): ColumnDataSource | undefined {
        const { selectedRowContent, columnDataSources, selectedColumn } = this
        if (selectedRowContent === undefined) return undefined
        if (
            selectedColumn === undefined ||
            selectedColumn >= columnDataSources.length
        ) {
            return undefined
        }
        return columnDataSources[selectedColumn]
    }

    @computed private get currentColumnFieldDescription():
        | FieldDescription
        | undefined {
        const { columnDataSource } = this

        return match(columnDataSource)
            .with(
                { kind: ColumnDataSourceType.FieldDescription },
                (source) => source.description
            )
            .otherwise(() => undefined)
    }

    @action.bound
    private onRichTextEditorChange(
        editor: codemirror.Editor,
        data: codemirror.EditorChange,
        value: string
    ) {
        if (data.origin !== undefined) {
            // origin seems to be +input when editing and undefined when we change the value programmatically
            const { currentColumnFieldDescription, grapherState } = this
            if (currentColumnFieldDescription === undefined) return
            this.hasUncommitedRichEditorChanges = true
            const pointer = jsonpointer.parse(
                currentColumnFieldDescription.pointer
            ) as string[]
            // Here we are setting the target column field directly at the grapher so the
            // preview is updated. When the user clicks the save button we'll then check
            // the value on grapher vs the value on the richDataRow and perform a proper
            // update using doAction like we do on the grid editor commits.
            setValueRecursiveInplace(grapherState, pointer, value)
        }
    }
    @action.bound
    commitRichEditorChanges() {
        this.commitOrCancelRichEditorChanges(true)
    }
    @action.bound
    cancelRichEditorChanges() {
        this.commitOrCancelRichEditorChanges(false)
    }

    @action.bound
    commitOrCancelRichEditorChanges(performCommit: boolean) {
        const {
            selectedRowContent,
            currentColumnFieldDescription,
            grapherState,
        } = this
        if (
            selectedRowContent === undefined ||
            currentColumnFieldDescription === undefined
        )
            return

        const pointer = jsonpointer.parse(
            currentColumnFieldDescription.pointer
        ) as string[]

        const prevVal = currentColumnFieldDescription.getter(
            selectedRowContent.config as Record<string, unknown>
        )
        if (performCommit) {
            const grapherObject = { ...this.grapherState.object }
            const newVal = currentColumnFieldDescription.getter(
                grapherObject as Record<string, unknown>
            )

            const patch: GrapherConfigPatch = {
                id: selectedRowContent.id,
                oldValue: prevVal,
                newValue: newVal,
                jsonPointer: currentColumnFieldDescription.pointer,
                oldValueIsEquivalentToNullOrUndefined:
                    currentColumnFieldDescription.default !== undefined &&
                    currentColumnFieldDescription.default === prevVal,
            }
            void this.doAction({ patches: [patch] })
        } else {
            setValueRecursiveInplace(grapherState, pointer, prevVal)
        }

        this.hasUncommitedRichEditorChanges = false
    }

    @action.bound
    onGenericRichEditorChange() {
        this.hasUncommitedRichEditorChanges = true
    }

    @computed get editControl(): React.ReactElement | undefined {
        const {
            currentColumnFieldDescription,
            grapherState,
            selectedRowContent,
        } = this
        if (
            currentColumnFieldDescription === undefined ||
            selectedRowContent === undefined
        )
            return undefined

        return match(currentColumnFieldDescription.editor)
            .with(
                EditorOption.primitiveListEditor,
                () =>
                    // TODO: handle different kinds of arrays here. In effect, the ones to handle are
                    // includedEntityNames, excludedEntityNames (both with a yet to extract control)
                    // selection. The seleciton should be refactored because ATM it's 3 arrays and it
                    // is annoying to keep those in sync and target more than one field with a column.
                    undefined
            )
            .with(EditorOption.colorEditor, () => {
                if (currentColumnFieldDescription?.pointer.startsWith("/map")) {
                    // TODO: remove this hack once map is more similar to other charts
                    const mapChart = new MapChart({
                        manager: this.grapherState,
                    })
                    const colorScale = mapChart.colorScale
                    // TODO: instead of using onChange below that has to be maintained when
                    // the color scale changes I tried to use a reaction here after Daniel G's suggestion
                    // but I couldn't get this to work. Worth trying again later.
                    // this.editControlDisposerFn = reaction(
                    //     () => colorScale,
                    //     () => this.onGenericRichEditorChange(),
                    //     { equals: comparer.structural }
                    // )
                    return colorScale ? (
                        <EditorColorScaleSection
                            scale={colorScale}
                            chartType={GRAPHER_MAP_TYPE}
                            features={{
                                legendDescription: false,
                            }}
                            showLineChartColors={false}
                            onChange={this.onGenericRichEditorChange}
                        />
                    ) : undefined
                } else {
                    if (grapherState.chartInstanceExceptMap.colorScale) {
                        const colorScale =
                            grapherState.chartInstanceExceptMap.colorScale
                        // TODO: instead of using onChange below that has to be maintained when
                        // the color scale changes I tried to use a reaction here after Daniel G's suggestion
                        // but I couldn't get this to work. Worth trying again later.
                        // this.editControlDisposerFn = reaction(
                        //     () => colorScale,
                        //     () => this.onGenericRichEditorChange(),
                        //     { equals: comparer.structural }
                        // )
                        return (
                            <EditorColorScaleSection
                                scale={colorScale}
                                chartType={
                                    grapherState.chartType ??
                                    GRAPHER_CHART_TYPES.LineChart
                                }
                                features={{
                                    legendDescription: false,
                                }}
                                showLineChartColors={grapherState.isLineChart}
                                onChange={this.onGenericRichEditorChange}
                            />
                        )
                    } else return undefined
                }
            })
            .with(EditorOption.textfield, EditorOption.textarea, () => (
                <CodeMirror
                    value={currentColumnFieldDescription.getter(
                        grapherState as any as Record<string, unknown>
                    )}
                    options={{
                        //theme: "material",
                        lineNumbers: true,
                        lineWrapping: true,
                    }}
                    autoCursor={false}
                    onChange={this.onRichTextEditorChange}
                />
            ))
            .otherwise(() => undefined)
    }

    async sendPatches(patches: GrapherConfigPatch[]): Promise<void> {
        await this.context.admin.rawRequest(
            this.config.apiEndpoint,
            JSON.stringify(patches),
            "PATCH"
        )
    }

    /** Used to send the inverse of a patch to undo a change that has previously been performed
     */
    async sendReversedPatches(patches: GrapherConfigPatch[]): Promise<void> {
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
            const rowId = richDataRows.findIndex((row) => row.id === patch.id)
            if (rowId === -1)
                console.error("Could not find row id in do step!", rowId)
            else {
                // apply the change to the richDataRows json structure

                richDataRows[rowId].config = applyPatch(
                    patch,
                    richDataRows[rowId].config
                )
            }
        }
        if (this.selectedRow) void this.updatePreviewToRow()
        await this.sendPatches(action.patches)
    }

    @action
    async undoAction(): Promise<void> {
        const { undoStack, redoStack } = this
        if (undoStack.length === 0) return
        // TODO: not yet properly implemented - figure out how to update the flat data rows and
        // set them here. Also change the rich data row entries
        const lastStep = undoStack.pop()
        redoStack.push(lastStep!)
        await this.sendReversedPatches(lastStep!.patches)
    }

    @action
    async redoAction(): Promise<void> {
        const { redoStack } = this
        if (redoStack.length === 0) return
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
            const asObject = Object.fromEntries(fields)
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
            /map/region: ...,
            ...
        } */
    @computed get flattenedDataRows(): unknown[] | undefined {
        const { richDataRows, fieldDescriptions, defaultValues } = this
        if (richDataRows === undefined || fieldDescriptions === undefined)
            return undefined
        const readOnlyColumns = this.config.readonlyColumns
        return this.richDataRows?.map((row) => {
            // for every field description try to get the value at this fields json pointer location
            // we cloneDeep it so that the value is independent in any case, even array or (in the future) objects
            // so that the grid will not change these values directly
            const fieldsArray = fieldDescriptions
                .map(
                    (fieldDesc) =>
                        [
                            fieldDesc.pointer,
                            row.config !== undefined
                                ? _.cloneDeep(
                                      fieldDesc.getter(
                                          row.config as Record<string, unknown>
                                      )
                                  )
                                : undefined,
                        ] as const
                )
                .filter(([, val]) => !_.isNil(val))
            const fields = Object.fromEntries(fieldsArray)
            const readOnlyColumnValues = [...readOnlyColumns.values()].map(
                (field) => [field.key, (row as any)[field.key]]
            )
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
            .with(EditorOption.numericWithLatestEarliest, () => "numeric")
            .with(EditorOption.textfield, () => "text")
            .with(EditorOption.textarea, () => "text")
            .with(EditorOption.colorEditor, () => "colorScale")
            .with(EditorOption.mappingEditor, () => "text")
            .with(EditorOption.primitiveListEditor, () => "text")
            .exhaustive()
    }
    static fieldDescriptionToColumn(
        desc: FieldDescription
    ): React.ReactElement {
        const name = desc.pointer //.substring(1)
        const type = GrapherConfigGridEditor.decideHotType(desc)
        if (desc.editor === EditorOption.colorEditor) {
            return (
                <HotColumn
                    key={desc.pointer}
                    settings={{
                        title: name,
                        data: desc.pointer,
                    }}
                >
                    <HotColorScaleRenderer hot-renderer />
                    <HotColorScaleEditor hot-editor />
                </HotColumn>
            )
        } else
            return (
                <HotColumn
                    key={desc.pointer}
                    settings={{
                        title: name,
                        readOnly:
                            desc.editor === EditorOption.primitiveListEditor ||
                            desc.editor === EditorOption.mappingEditor,
                        type: type,
                        source: desc.enumOptions,
                        data: desc.pointer,
                    }}
                />
            )
    }

    @computed get columnDataSources(): ColumnDataSource[] {
        const { fieldDescriptions, columnSelection } = this

        if (fieldDescriptions === undefined || columnSelection.length === 0)
            return []
        const readOnlyColumns = this.config.readonlyColumns
        const fieldDescriptionsMap = new Map(
            fieldDescriptions.map((fieldDesc) => [fieldDesc.pointer, fieldDesc])
        )
        const columns: ColumnDataSource[] = columnSelection.map(
            (columnInformation) => {
                if (isConfigColumn(columnInformation.key)) {
                    const fieldDesc = fieldDescriptionsMap.get(
                        columnInformation.key
                    )
                    if (fieldDesc === undefined) {
                        return {
                            kind: ColumnDataSourceType.Unkown,
                            fieldKey: columnInformation.key,
                            columnInformation,
                        }
                    } else
                        return {
                            kind: ColumnDataSourceType.FieldDescription,
                            description: fieldDesc,
                            columnInformation,
                        }
                } else {
                    const readonlyField = readOnlyColumns.get(
                        columnInformation.key
                    )
                    if (readonlyField === undefined) {
                        return {
                            kind: ColumnDataSourceType.Unkown,
                            fieldKey: columnInformation.key,
                            columnInformation,
                        }
                    } else
                        return {
                            kind: ColumnDataSourceType.ReadOnlyColumn,
                            readOnlyColumn: readonlyField,
                            columnInformation,
                        }
                }
            }
        )
        return columns
    }

    @computed get hotColumns(): React.ReactElement[] {
        const { columnDataSources } = this

        const columns = columnDataSources.map((columnDataSource) =>
            match(columnDataSource)
                .with(
                    { kind: ColumnDataSourceType.FieldDescription },
                    (columnDataSource) =>
                        GrapherConfigGridEditor.fieldDescriptionToColumn(
                            columnDataSource.description
                        )
                )
                .with(
                    { kind: ColumnDataSourceType.ReadOnlyColumn },
                    (columnDataSource) => (
                        <HotColumn
                            key={columnDataSource.readOnlyColumn.key}
                            settings={{
                                title: columnDataSource.readOnlyColumn.label,
                                readOnly: true,
                                data: columnDataSource.readOnlyColumn.key,
                            }}
                        />
                    )
                )
                .with({ kind: ColumnDataSourceType.Unkown }, () => undefined)
                .exhaustive()
        )
        const definedColumns = excludeUndefined(columns)
        // If we have columns that we couldn't match, find out which ones they were and console.error them
        const undefinedColumns = columnDataSources.filter(
            (item): item is ColumnDataSourceUnknown =>
                item.kind === ColumnDataSourceType.Unkown
        )
        if (!_.isEmpty(undefinedColumns))
            console.error("Some columns could not be found!", undefinedColumns)
        return definedColumns
    }

    @action.bound
    updateSelection(
        row1: number,
        column1: number,
        row2: number,
        column2: number
    ): void {
        if (this.hasUncommitedRichEditorChanges) this.cancelRichEditorChanges()
        if (row1 !== this.selectedRow) {
            this.hasUncommitedRichEditorChanges = false
            this.selectedRow = row1
            void this.updatePreviewToRow()
        }
        this.selectionEndRow = row2
        if (column1 !== this.selectedColumn) {
            this.hasUncommitedRichEditorChanges = false
            this.selectedColumn = column1
        }
        this.selectionEndColumn = column2
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
                this.validateCellChanges(excludeNull(changes), source),
            afterSelectionEnd: (row, column, row2, column2 /*, layer*/) => {
                this.updateSelection(row, column, row2, column2)
            },
            beforeKeyDown: (
                event // TODO: check if this works ok with normal editing delete key use
            ) => (event.key === "Delete" ? this.clearCellContent() : undefined),
            modifyColWidth: (width) => {
                if (width > 350) {
                    return 300
                }
                return undefined
            },
            allowInsertColumn: false,
            allowInsertRow: false,
            autoRowSize: false,
            autoColumnSize: true,
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
    @action.bound
    clearCellContent() {
        const {
            selectedRow,
            selectedColumn,
            selectionEndColumn,
            selectionEndRow,
            columnDataSources,
            richDataRows,
        } = this
        if (
            selectedRow === undefined ||
            selectedColumn === undefined ||
            selectionEndRow === undefined ||
            selectionEndColumn === undefined ||
            richDataRows === undefined
        )
            return

        const selectedRows = _.range(selectedRow, selectionEndRow + 1)
        const selectedColumns = _.range(selectedColumn, selectionEndColumn + 1)
        const patches: GrapherConfigPatch[] = []

        for (const column of selectedColumns) {
            const columnDataSource = columnDataSources[column]
            if (
                columnDataSource.kind === ColumnDataSourceType.FieldDescription
            ) {
                const pointer = columnDataSource.description.pointer
                for (const row of selectedRows) {
                    const rowData = richDataRows[row]
                    const prevVal = columnDataSource.description.getter(
                        rowData.config as Record<string, unknown>
                    )
                    const patch: GrapherConfigPatch = {
                        id: rowData.id,
                        oldValue: prevVal,
                        newValue: null,
                        jsonPointer: pointer,
                        oldValueIsEquivalentToNullOrUndefined:
                            columnDataSource.description.default !==
                                undefined &&
                            columnDataSource.description.default === prevVal,
                    }
                    patches.push(patch)
                }
            }
        }

        void this.doAction({ patches })
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
            .with([FieldType.complex, P._], () => false) // complex types, e.g. color scales, are handled specially, allow them here
            .with([[P._], "string"], () => false)

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
            let oldValueIsEquivalentToNullOrUndefined = false

            // we normalize the default values to null (we don't want to store them and null leads to removing the key)
            if (
                fieldDesc?.default !== undefined &&
                prevVal === fieldDesc?.default
            )
                oldValueIsEquivalentToNullOrUndefined = true
            if (
                fieldDesc?.default !== undefined &&
                newVal === fieldDesc?.default
            )
                newVal = null

            // Type conversion
            // If we have an array of both strings and number then the value we get here will always
            // be a string. Check if we can coerce it to number and do so if possible
            if (
                _.isArray(fieldDesc?.type) &&
                fieldDesc?.type.find(
                    (type) =>
                        type === FieldType.number || type === FieldType.integer
                ) &&
                !Number.isNaN(Number.parseFloat(newVal))
            )
                newVal = Number.parseFloat(newVal)

            if (fieldDesc && fieldDesc.type === FieldType.complex) {
                prevVal = fieldDesc.getter(
                    row.config as Record<string, unknown>
                )
                const grapherObject = { ...this.grapherState.object }
                newVal = fieldDesc.getter(
                    grapherObject as Record<string, unknown>
                )
            }

            // Now construct the patch and store it
            const patch: GrapherConfigPatch = {
                id: row.id,
                oldValue: prevVal,
                newValue: newVal,
                oldValueIsEquivalentToNullOrUndefined,
                jsonPointer: column as string,
            }
            patches.push(patch)
        }
        // Perform a do operation that will add this to the undo stack and immediately
        // post this as a PATCH request to the server
        void this.doAction({ patches })
    }

    async getFieldDefinitions() {
        const json = await fetch(
            "https://files.ourworldindata.org/schemas/grapher-schema.008.json"
        ).then((response) => response.json())
        const fieldDescriptions = extractFieldDescriptionsFromSchema(json)
        runInAction(() => {
            // Now that we have the field Definitions we can initialize everything, including
            // the filter fields from the query string
            this.fieldDescriptions = fieldDescriptions

            this.initializeColumnSelection(
                fieldDescriptions,
                this.currentColumnSet
            )

            // Get query params and convert them into a fetchVariables data structure
            const url = getWindowUrl()
            const queryParams = url.queryParams
            const fetchParamsFromQueryParams =
                fetchVariablesParametersFromQueryString(
                    queryParams,
                    this.config.sExpressionContext
                )

            // We serialize our own SExpression into the query string. We now
            // need to get this in a form that the React Awesome Query Builder can process.
            // The easiest of the formats that library can load is JsonLogic, so we convert
            // to JsonLogic and postprocess to fix some issues
            let jsonLogic = SExpressionToJsonLogic(
                fetchParamsFromQueryParams.filterQuery,
                this.config.readonlyColumns
            )
            if (jsonLogic === true) jsonLogic = null // If we have the default query then don't bother any further

            let jsonLogicTree = Utils.loadFromJsonLogic(
                jsonLogic as any,
                this.FilterPanelConfig ?? filterPanelInitialConfig
            )

            if (jsonLogicTree !== undefined) {
                const mutableTree = Utils.getTree(jsonLogicTree)
                postprocessJsonLogicTree(mutableTree)
                jsonLogicTree = QbUtils.loadTree(mutableTree)
            }

            // If we didn't get a working tree then use our default one instead
            const tree =
                jsonLogicTree ?? QbUtils.loadTree(initialFilterQueryValue)
            this.filterState = {
                tree: QbUtils.sanitizeTree(
                    tree,
                    this.FilterPanelConfig ?? filterPanelInitialConfig
                ).fixedTree,
                config: this.FilterPanelConfig ?? filterPanelInitialConfig,
            }

            // Now set the remaining filter fields from the parsed query string
            this.sortByColumn = fetchParamsFromQueryParams.sortByColumn
            this.sortByAscending = fetchParamsFromQueryParams.sortByAscending
            this.desiredPagingOffset = fetchParamsFromQueryParams.offset
        })

        // This autorun updates the query params in the URL (without creating history steps)
        // to always reflect the current data query state (i.e. filtering and paging)
        const disposer = autorun(() => {
            const fetchParamsFromQueryParamsAsStrings =
                fetchVariablesParametersToQueryParameters(
                    this.dataFetchParameters
                )
            const defaultValues = fetchVariablesParametersFromQueryString(
                {},
                this.config.sExpressionContext
            )
            const defaultValuesAsStrings =
                fetchVariablesParametersToQueryParameters(defaultValues)
            // Only store non-default values in the query params
            const nonDefaultValues = _.omitBy(
                fetchParamsFromQueryParamsAsStrings,
                (value, key) => (defaultValuesAsStrings as any)[key] === value
            )
            const url = getWindowUrl()
            const newUrl = url.setQueryParams(nonDefaultValues)
            if (!_.isEqual(url, newUrl)) setWindowUrl(newUrl)
        })
        this.disposers.push(disposer)
    }

    @action
    initializeColumnSelection(
        fieldDescriptions: FieldDescription[] | undefined,
        currentColumnSet: ColumnSet
    ) {
        if (fieldDescriptions === undefined) return
        const readOnlyColumns = this.config.readonlyColumns
        const hiddenColumns = this.config.hiddenColumns
        // Now we need to construct the initial order and visibility state of all ColumnReorderItems
        // First construct them from the fieldDescriptions (from the schema) and the hardcoded readonly column names
        const fieldDescReorderItems: ColumnInformation[] = fieldDescriptions
            .filter((fieldDesc) => !hiddenColumns.has(fieldDesc.pointer))
            .map((item) => ({
                key: item.pointer,
                visible: false,
                description: item.description,
            }))
        const readonlyReorderItems: ColumnInformation[] = [
            ...readOnlyColumns.values(),
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
                                .with(Tabs.EditorTab, () =>
                                    this.renderEditorTab()
                                )
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

    renderEditorTab(): React.ReactElement {
        const { editControl, hasUncommitedRichEditorChanges } = this
        return (
            <section>
                <div className="container">{editControl}</div>
                {hasUncommitedRichEditorChanges ? (
                    <div className="container rich-editor-confirm-buttons">
                        <button
                            className="btn btn-primary"
                            onClick={() => this.commitRichEditorChanges()}
                        >
                            Commit
                        </button>

                        <button
                            className="btn btn-secondary"
                            onClick={() => this.cancelRichEditorChanges()}
                        >
                            Cancel
                        </button>
                    </div>
                ) : null}
            </section>
        )
    }

    @action.bound
    setKeepEntitySelectionOnChartChange(value: boolean) {
        this.keepEntitySelectionOnChartChange = value
    }

    @action.bound
    pageToPreviousPage(): void {
        if (
            (this.numTotalRows ?? 0) > PAGEING_SIZE &&
            this.desiredPagingOffset >= PAGEING_SIZE
        )
            this.desiredPagingOffset -= PAGEING_SIZE
    }

    @action.bound
    pageToNextPage(): void {
        if (
            (this.numTotalRows ?? 0) > PAGEING_SIZE &&
            this.desiredPagingOffset + PAGEING_SIZE < (this.numTotalRows ?? 0)
        ) {
            this.desiredPagingOffset += PAGEING_SIZE
        }
    }

    renderPagination(): React.ReactElement {
        const { numTotalRows, currentPagingOffset } = this
        const currentStartLabel = currentPagingOffset + 1
        const currentEndLabel = Math.min(
            currentPagingOffset + PAGEING_SIZE,
            numTotalRows ?? 0
        )

        return (
            <nav aria-label="Indicator annotation pagination controls">
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

    renderFilterTab(): React.ReactElement {
        const { FilterPanelConfig, filterState } = this
        return (
            <section>
                <div className="container">
                    <h3>Row filters</h3>
                    {this.renderPagination()}
                    <label>Query builder</label>
                    {FilterPanelConfig && filterState && (
                        <Query
                            {...FilterPanelConfig}
                            value={filterState.tree}
                            onChange={this.updateFilterState}
                            renderBuilder={QueryBuilderContainer}
                        />
                    )}
                    <small className="form-text text-muted">
                        Note that default values like empty string, "LineChart"
                        for type or the default checkbox state are often stored
                        as null. To find these you have to use the "is null"
                        operator.
                    </small>
                    {
                        // Uncomment below to see the generated S-expression
                        //<div>{filterSExpression?.toSExpr()}</div>
                    }
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
        columnSelection: ColumnInformation[],
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
            const lastVisibleIndex = columnSelection.findLastIndex(
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
        const columnSets = this.config.columnSet
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

    @computed
    get selectedRowContent(): VariableAnnotationsRow | undefined {
        const { selectedRow, richDataRows } = this
        const row =
            selectedRow !== undefined && richDataRows !== undefined
                ? richDataRows[selectedRow]
                : undefined
        return row
    }

    @action.bound
    onShowOnlyColumnsWithValuesInCurrentRow() {
        const { columnDataSources, selectedRowContent } = this
        const row = selectedRowContent
        if (row !== undefined) {
            const newSelection: ColumnInformation[] = columnDataSources.map(
                (item): ColumnInformation =>
                    match(item)
                        .with(
                            { kind: ColumnDataSourceType.FieldDescription },
                            (columnDataSource) => ({
                                ...columnDataSource.columnInformation,
                                visible:
                                    columnDataSource.description.getter(
                                        row.config as Record<string, unknown>
                                    ) !== undefined,
                            })
                        )
                        .with(
                            { kind: ColumnDataSourceType.ReadOnlyColumn },
                            (columnDataSource) => ({
                                ...columnDataSource.columnInformation,
                                visible: (row as any)[
                                    columnDataSource.readOnlyColumn.key
                                ],
                            })
                        )
                        .with(
                            { kind: ColumnDataSourceType.Unkown },
                            (columnDataSource) => ({
                                ...columnDataSource.columnInformation,
                                visible: false,
                            })
                        )
                        .exhaustive()
            )
            this.columnSelection = newSelection
        }
    }

    renderColumnsTab(): React.ReactElement {
        const { columnSelection, currentColumnSet, columnFilter } = this
        const columnSets = this.config.columnSet
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
                    <button
                        className="btn btn-secondary"
                        onClick={this.onShowOnlyColumnsWithValuesInCurrentRow}
                        title="Show only columns where the current row has a set value"
                        disabled={this.selectedRow === undefined}
                    >
                        Show only columns with values in current row
                    </button>
                    <BindString
                        field="columnFilter"
                        store={this}
                        label="Filter columns"
                        buttonContent="Clear"
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

    renderPreviewArea(): React.ReactElement {
        const { grapherState } = this
        return (
            <div className="preview">
                <h5>Interactive grapher preview</h5>
                <details open>
                    <summary>Hide/Show the preview</summary>
                    <Toggle
                        label="Keep entity/country selection when switching rows"
                        title="If set then the country selection will stay the same while switching rows even if the underlying chart has a different selection"
                        value={this.keepEntitySelectionOnChartChange}
                        onValue={this.setKeepEntitySelectionOnChartChange}
                    />
                    <Grapher grapherState={grapherState} />
                </details>
            </div>
        )
    }

    buildDataFetchUrl(fetchParameters: FetchVariablesParameters): string {
        const filter =
            fetchVariablesParametersToQueryParametersString(fetchParameters)
        const baseUrl = `/admin${this.config.apiEndpoint}`
        return baseUrl + filter
    }

    componentWillUnmount() {
        for (const disposer of this.disposers) {
            disposer()
        }
        this.disposers = []
    }

    @action.bound
    updateFilterState(immutableTree: ImmutableTree, config: Config) {
        const { filterState } = this

        const updateFilterState = !(
            _.isEqual(filterState?.tree, immutableTree) &&
            _.isEqual(filterState?.config, config)
        )

        if (updateFilterState) {
            this.filterState = {
                ...filterState,
                tree: immutableTree,
                config: config,
            }
        }
    }

    @computed get filterSExpression(): Operation | undefined {
        const { filterState } = this
        const readOnlyColumns = this.config.readonlyColumns
        if (filterState) {
            const tree = QbUtils.getTree(filterState.tree)
            const sExpression = filterTreeToSExpression(
                tree,
                this.config.sExpressionContext,
                readOnlyColumns
            )

            return sExpression
        }
        return undefined
    }

    @computed get filterPanelConfigFields(): [string, SimpleField][] {
        const { columnSelection, fieldDescriptions } = this
        // The editors to use use are decided by two helper functions. For
        // the more interesting fieldDescription mapping we rely on the
        // preferred editor that is set in the editorOption field of the fieldDescription

        if (fieldDescriptions === undefined) return []
        const fieldDescriptionMap = new Map(
            fieldDescriptions.map((fd) => [fd.pointer, fd])
        )
        const readOnlyColumns = this.config.readonlyColumns
        const fields = excludeUndefined(
            columnSelection.map((column) => {
                if (isConfigColumn(column.key)) {
                    return fieldDescriptionToFilterPanelFieldConfig(
                        fieldDescriptionMap.get(column.key)!
                    )
                } else {
                    return simpleColumnToFilterPanelFieldConfig(
                        readOnlyColumns.get(column.key)!
                    )
                }
            })
        )
        return fields
    }

    @computed get FilterPanelConfig(): Config | undefined {
        const { filterPanelConfigFields } = this

        if (_.isEmpty(filterPanelConfigFields)) return undefined

        const fieldsObject = Object.fromEntries(filterPanelConfigFields)
        const config = {
            ...filterPanelInitialConfig,
            fields: fieldsObject,
        }
        // Hide operators in the UI that we don't have a good equivalent for
        // in the S-Expressions. For easier comprehension the inverse set of operators
        // as of react-awesome-query-builder V4 is kept below in commented out form
        const operatorsToKeep = [
            "equal",
            "not_equal",
            "less",
            "less_or_equal",
            "greater",
            "greater_or_equal",
            "like",
            "is_empty",
            "is_not_empty",
            "is_null",
            "is_not_null",
            "select_equals",
            "select_not_equals",
            "some",
            "all",
            "none",
        ]
        // const operatorsToDrop = [
        //     "not_like",
        //     "proximity",
        //     "starts_with",
        //     "ends_with",
        //     "between",
        //     "not_between",
        //     "select_any_in",
        //     "select_not_any_in",
        //     "multiselect_equals",
        //     "multiselect_not_equals",
        // ]
        config.operators = _.pick(config.operators, operatorsToKeep) as any

        config.operators = {
            ...config.operators,
            is_latest: {
                label: "Is latest",
                labelForFormat: "Is latest",
                sqlOp: "=",
                cardinality: 0,
                jsonLogic: "==",
            },
            is_earliest: {
                label: "Is earliest",
                labelForFormat: "Is earliest",
                sqlOp: "=",
                cardinality: 0,
                jsonLogic: "==",
            },
        } as any
        config.types.number.widgets.number.operators!.push("is_latest")
        config.types.number.widgets.number.operators!.push("is_earliest")

        config.settings.customFieldSelectProps = { showSearch: true }
        return config
    }
}
