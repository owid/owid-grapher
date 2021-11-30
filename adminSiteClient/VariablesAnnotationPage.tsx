import * as React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    action,
    runInAction,
    reaction,
    IReactionDisposer,
} from "mobx"
import { match, __, not, select, when } from "ts-pattern"
//import * as lodash from "lodash"
import { fromPairs, isArray, isNil, omitBy, zipObject } from "lodash"

import { HotColumn, HotTable } from "@handsontable/react"
import { AdminLayout } from "./AdminLayout"
import { SearchField, FieldsRow } from "./Forms"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import {
    FieldDescription,
    extractFieldDescriptionsFromSchema,
    FieldType,
    EditorOption,
} from "../clientUtils/schemaProcessing"

import Handsontable from "handsontable"
import { GrapherInterface } from "../grapher/core/GrapherInterface"
import { Bounds } from "../clientUtils/Bounds"

interface VariableAnnotationsResponseRow {
    id: number
    name: string
    grapherConfig: string
    datasetname: string
    namespacename: string
}

interface VariableAnnotationsRow {
    id: number
    name: string
    grapherConfig: GrapherInterface
    datasetname: string
    namespacename: string
}

function parseVariableAnnotationsRow(
    row: VariableAnnotationsResponseRow
): VariableAnnotationsRow {
    return {
        ...row,
        grapherConfig: JSON.parse(row.grapherConfig),
    }
}

interface VariableAnnotationsResponse {
    numTotalRows: number
    variables: VariableAnnotationsResponseRow[]
}

@observer
class VariablesAnnotationComponent extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType
    @observable.ref fieldDescriptions: FieldDescription[] | undefined =
        undefined
    @observable.ref richDataRows: VariableAnnotationsRow[] | undefined =
        undefined

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
        console.log("default", defaultValues)
        return this.richDataRows?.map((row) => {
            const fieldsArray = fieldDescriptions
                .map(
                    (fieldDesc) =>
                        [
                            fieldDesc.pointer,
                            row.grapherConfig != undefined
                                ? fieldDesc.getter(
                                      row.grapherConfig as Record<
                                          string,
                                          unknown
                                      >
                                  )
                                : undefined,
                        ] as const
                )
                .filter(([name, val]) => !isNil(val))
            const fields = fromPairs(fieldsArray as any)
            console.log("fields values", fields)
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
            const grapherColumns = fieldDescriptions.map(
                VariablesAnnotationComponent.fieldDescriptionToColumn
            )
            return [...readOnlyColumns, ...grapherColumns]
        }
    }
    numTotalRows: number | undefined = undefined
    //private hotTableComponent = React.createRef<HotTable>()
    @computed
    private get hotSettings() {
        const { flattenedDataRows } = this
        if (flattenedDataRows === undefined) return undefined
        // const cells = function (row: number, column: number) {
        //     const {
        //         comment,
        //         cssClasses,
        //         optionKeywords,
        //         placeholder,
        //         contents,
        //     } = program.getCell({ row, column })

        //     const cellContentsOnDisk = programOnDisk.getCellContents({
        //         row,
        //         column,
        //     })

        //     const cellProperties: Partial<Handsontable.CellProperties> = {}

        //     const allClasses = cssClasses?.slice() ?? []

        //     if (cellContentsOnDisk !== contents) {
        //         if (contents === "" && cellContentsOnDisk === undefined)
        //             allClasses.push("cellCreated")
        //         else if (isEmpty(contents)) allClasses.push("cellDeleted")
        //         else if (isEmpty(cellContentsOnDisk))
        //             allClasses.push("cellCreated")
        //         else allClasses.push("cellChanged")
        //     }

        //     if (currentlySelectedGrapherRow === row && column)
        //         allClasses.push(`currentlySelectedGrapherRow`)

        //     cellProperties.className = allClasses.join(" ")
        //     cellProperties.comment = comment ? { value: comment } : undefined
        //     cellProperties.placeholder = placeholder

        //     if (optionKeywords && optionKeywords.length) {
        //         cellProperties.type = "autocomplete"
        //         cellProperties.source = optionKeywords
        //     }

        //     return cellProperties
        // }

        const hotSettings: Handsontable.GridSettings = {
            afterChange: (changes, source) =>
                this.processChangedCells(changes, source),
            beforeChange: (changes, source) =>
                this.validateCellChanges(changes, source),
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
        if (source === "loadData" || changes === null) return // Changes due to loading are always ok
        // cancel editing if multiple columns are changed at the same time
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

        const allChangesSameType = changes.every(
            (change) => typeof change[3] === typeof changes[0][3]
        )
        if (!allChangesSameType) {
            console.error("Not all changes were of the same type?")
            return
        }

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
            .with([[__], "object"], (_) => false) // typeof Array is object!

            .otherwise((_) => true)
        if (invalidTypeAssignment) return false

        // TODO: locally apply values here and see if they parse the schema? Might be an easy
        // highlevel way to verify that enums are obeyed etc. But might also be tricky to debug
        // if validation fails for nonobvious reasons

        return
    }

    processChangedCells(
        changes: Handsontable.CellChange[] | null,
        source: Handsontable.ChangeSource
    ): void {
        // We don't want to persist changes due to loading data
        if (source === "loadData" || changes === null) return

        for (const change of changes) console.log("Cell changed", change)
    }

    async getData() {
        const json = (await this.context.admin.getJSON(
            "/api/variable-annotations"
        )) as VariableAnnotationsResponse
        runInAction(() => {
            this.richDataRows = json.variables.map(parseVariableAnnotationsRow)
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
        const { hotSettings, hotColumns } = this
        if (hotSettings === undefined) return <div>Loading</div>
        else
            return (
                <HotTable
                    settings={this.hotSettings}
                    //ref={this.hotTableComponent as any}
                    licenseKey={"non-commercial-and-evaluation"}
                >
                    {hotColumns}
                </HotTable>
            )
    }

    async componentDidMount() {
        // TODO: run these in parallel but await them and handle errors
        this.getData()
        this.getFieldDefinitions()
        // this.dispose = reaction(
        //     () => this.searchInput || this.maxVisibleRows,
        //     lodash.debounce(() => this.getData(), 200)
        // )
        // this.getData()
    }

    componentWillUnmount() {
        //this.dispose()
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
