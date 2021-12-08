import * as React from "react"
import { Disposer, observer } from "mobx-react"
import { observable, computed, action, runInAction, autorun } from "mobx"
import { match, __ } from "ts-pattern"
//import * as lodash from "lodash"
import { cloneDeep, fromPairs, isArray, isNil, merge } from "lodash"

import jsonpointer from "json8-pointer"
import { HotColumn, HotTable } from "@handsontable/react"
import { AdminLayout } from "./AdminLayout"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { applyPatch } from "../clientUtils/patchHelper"
import {
    SqlColumnName,
    SQL_COLUMN_NAME_VARIABLE_NAME,
    StringAtom,
    StringContainsOperation,
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
import { from } from "rxjs"
import { debounceTime, distinctUntilChanged } from "rxjs/operators"
import { toStream, fromStream, IStreamListener } from "mobx-utils"

function parseVariableAnnotationsRow(
    row: VariableAnnotationsResponseRow
): VariableAnnotationsRow {
    return {
        ...row,
        grapherConfig: JSON.parse(row.grapherConfig),
    }
}

interface VariableAnnotationsRow {
    id: number
    name: string
    grapherConfig: GrapherInterface
    datasetname: string
    namespacename: string
}

interface UndoStep {
    patches: VariableAnnotationPatch[]
}

const enum Tabs {
    PreviewTab = "PreviewTab",
    EditorTab = "EditorTab",
    FilterTab = "FilterTab",
}

const ALL_TABS = [Tabs.PreviewTab, Tabs.EditorTab, Tabs.FilterTab]

@observer
class VariablesAnnotationComponent extends React.Component<
    Record<string, never>,
    Record<string, never>,
    Record<string, never>
> {
    static contextType = AdminAppContext

    @observable.ref grapher = new Grapher()
    @observable.ref grapherElement?: JSX.Element
    numTotalRows: number | undefined = undefined
    selectedRow: number | undefined = undefined
    @observable activeTab = Tabs.FilterTab

    context!: AdminAppContextType
    @observable.ref fieldDescriptions: FieldDescription[] | undefined =
        undefined
    @observable.ref richDataRows: VariableAnnotationsRow[] | undefined =
        undefined

    @observable undoSteps: UndoStep[] = []
    @observable redoSteps: UndoStep[] = []
    @observable variableNameFilter: string = ""
    @observable currentPagingOffset: number = 0
    disposers: Disposer[] = []
    //debouncedVariableNameFilterListener: IStreamListener<string | undefined>
    // @computed get debouncedVariableNameFilter(): string | undefined {
    //     return this.debouncedVariableNameFilterListener.current
    // }

    constructor(props: Record<string, never>) {
        super(props)

        //this.debouncedVariableNameFilterListener = fromStream(observable)
    }
    @action.bound private resetViewStateAfterFetch(): void {
        this.undoSteps = []
        this.redoSteps = []
        this.selectedRow = undefined
        this.grapherElement = undefined
    }
    @action.bound private loadGrapherJson(json: any): void {
        const newConfig: GrapherProgrammaticInterface = {
            ...json,
            bounds:
                //this.editor?.previewMode === "mobile"
                //? new Bounds(0, 0, 360, 500)
                new Bounds(0, 0, 800, 600),
            getGrapherInstance: (grapher: Grapher) => {
                this.grapher = grapher
            },
        }
        if (this.grapherElement) {
            {
                this.grapher.setAuthoredVersion(newConfig)
                this.grapher.reset()
                this.grapher.updateFromObject(newConfig)
                this.grapher.downloadData()
            }
        } else this.grapherElement = <Grapher {...newConfig} />
    }

    @action private updatePreviewToRow(row: number): void {
        const { richDataRows } = this
        console.log("updating preview to row", row)
        if (richDataRows === undefined) return
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

    @action
    async do(step: UndoStep): Promise<void> {
        const { richDataRows } = this
        if (richDataRows === undefined) return

        this.undoSteps.push(step)

        for (const patch of step.patches) {
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
        await this.sendPatches(step.patches)
    }

    @action
    async undo(): Promise<void> {
        const { undoSteps, redoSteps } = this
        if (undoSteps.length == 0) return
        // TODO: not yet properly implemented - figure out how to update the flat data rows and
        // set them here. Also change the rich data row entries
        const lastStep = undoSteps.pop()
        redoSteps.push(lastStep!)
        await this.sendReversedPatches(lastStep!.patches)
    }

    @action
    async redo(): Promise<void> {
        const { redoSteps } = this
        if (redoSteps.length == 0) return
        // TODO: not yet properly implemented - figure out how to update the flat data rows and
        // set them here. Also change the rich data row entries
        const lastStep = redoSteps.pop()
        this.undoSteps.push(lastStep!)
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
                    readOnly: false,
                    type: VariablesAnnotationComponent.decideHotType(desc),
                    source: desc.enumOptions,
                    data: desc.pointer,
                    width: Bounds.forText(name).width,
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
                                width: Bounds.forText(nameAndField[0]).width,
                            }}
                        />
                    )
                )
            // then all the others coming from the fieldDescriptions
            const grapherColumns = fieldDescriptions.map(
                VariablesAnnotationComponent.fieldDescriptionToColumn
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
        // Changes due to loading are always ok (return flags all as ok)
        if (source === "loadData" || changes === null) return

        // cancel editing if multiple columns are changed at the same time - we
        // currently only support changes to a single column at a time
        const differentColumns = new Set(changes.map((change) => change[1]))
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
            (change) => typeof change[3] === typeof changes[0][3]
        )
        if (!allChangesSameType) {
            console.error("Not all changes were of the same type?")
            return
        }

        // Check if the type matches the target (e.g. to avoid a string value ending
        // up in a text field). This is hard to nail down fully but we try to avoid
        // such mistakes where possible
        const firstNewValue = changes[0][3]
        const invalidTypeAssignment = match<
            [FieldType | FieldType[], string],
            boolean
        >([columnDefinition.type, typeof firstNewValue])
            .with([FieldType.string, "string"], (_) => false)
            .with([FieldType.number, "string"], (_) =>
                Number.isNaN(Number.parseFloat(firstNewValue))
            )
            .with([FieldType.integer, "string"], (_) =>
                Number.isNaN(Number.parseFloat(firstNewValue))
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
        this.do({ patches })
    }

    async getData(variableFilter: string, offset: number) {
        const filter =
            variableFilter !== ""
                ? new StringContainsOperation(
                      new SqlColumnName(SQL_COLUMN_NAME_VARIABLE_NAME),
                      new StringAtom(variableFilter)
                  ).toSExpr()
                : undefined
        const json = (await this.context.admin.getJSON(
            "/api/variable-annotations",
            { filter, offset }
        )) as VariableAnnotationsResponse
        runInAction(() => {
            this.resetViewStateAfterFetch()
            this.richDataRows = json.variables.map(parseVariableAnnotationsRow)
            this.currentPagingOffset = offset
            this.numTotalRows = json.numTotalRows
        })
    }

    async getFieldDefinitions() {
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
        const {
            hotSettings,
            hotColumns,
            grapherElement,
            numTotalRows,
            activeTab,
        } = this
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
                        <div>
                            {activeTab === Tabs.FilterTab
                                ? this.renderFilterTab()
                                : null}
                            {activeTab === Tabs.PreviewTab
                                ? this.renderPreviewTab()
                                : null}
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

    renderFilterTab(): JSX.Element {
        const { numTotalRows } = this
        return (
            <section>
                <h3>Variable filters</h3>
                <p>
                    Total variable count matching the active filter:{" "}
                    {numTotalRows}
                </p>

                <BindString
                    field="variableNameFilter"
                    store={this}
                    label="Variable name"
                />
            </section>
        )
    }

    renderPreviewTab(): JSX.Element {
        const { grapherElement } = this
        return (
            <React.Fragment>
                <h3>Interactive grapher preview</h3>
                {grapherElement ? grapherElement : null}
            </React.Fragment>
        )
    }

    async componentDidMount() {
        // TODO: run these in parallel but await them and handle errors
        //this.getData("", 0)
        const varStream = toStream(() => this.variableNameFilter)
        const observable = from(varStream).pipe(
            debounceTime(200),
            distinctUntilChanged()
            // TODO: Usually in RxJS we would do a switchMap here with a fromFetch for the data fetching
            // and get automatic cancelling of obsolete HTTP requests. This would mean changing the entire error
            // handling a bit for the getData function so I'm not doing this now but it might be a nice
            // change in the future
        )
        const mobxValue = fromStream(observable)
        const disposer = autorun(() => this.getData(mobxValue.current ?? "", 0))
        this.disposers.push(disposer)

        this.getFieldDefinitions()
        // this.dispose = reaction(
        //     () => this.searchInput || this.maxVisibleRows,
        //     lodash.debounce(() => this.getData(), 200)
        // )
        // this.getData()
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
