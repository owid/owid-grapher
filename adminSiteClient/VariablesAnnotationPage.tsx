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
//import * as lodash from "lodash"
import { zipObject } from "lodash"

import { HotTable } from "@handsontable/react"
import { AdminLayout } from "./AdminLayout"
import { SearchField, FieldsRow } from "./Forms"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import {
    FieldDescription,
    extractFieldDescriptionsFromSchema,
} from "../clientUtils/schemaProcessing"

import Handsontable from "handsontable"
import { GrapherInterface } from "../grapher/core/GrapherInterface"

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
    @observable.ref fieldDescriptions:
        | FieldDescription[]
        | undefined = undefined
    @observable.ref richDataRows:
        | VariableAnnotationsRow[]
        | undefined = undefined
    @computed get flattenedDataRows(): unknown[] | undefined {
        const { richDataRows, fieldDescriptions } = this
        if (richDataRows === undefined || fieldDescriptions === undefined)
            return undefined

        return this.richDataRows?.map((row) => {
            const fieldsArray = fieldDescriptions.map(
                (fieldDesc) =>
                    [
                        fieldDesc.pointer,
                        fieldDesc.getter(
                            row.grapherConfig as Record<string, unknown>
                        ),
                    ] as const
            )
            const fields = zipObject(fieldsArray as any)
            return {
                id: row.id,
                name: row.name,
                datasetname: row.datasetname,
                namespacename: row.namespacename,
                ...fields, // TODO add
            }
        })
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
            // afterChange: () => this.updateProgramFromHot(),
            // afterRemoveRow: () => this.updateProgramFromHot(),
            // afterRemoveCol: () => this.updateProgramFromHot(),
            allowInsertColumn: false,
            allowInsertRow: false,
            autoRowSize: false,
            autoColumnSize: false,
            // cells,
            colHeaders: true,
            comments: true,
            // contextMenu: {
            //     items: {
            //         AutofillColDefCommand: new AutofillColDefCommand(
            //             program,
            //             (newProgram: string) => this.props.onChange(newProgram)
            //         ).toHotCommand(),
            //         InlineDataCommand: new InlineDataCommand(
            //             program,
            //             (newProgram: string) => this.props.onChange(newProgram)
            //         ).toHotCommand(),
            //         SelectAllHitsCommand: new SelectAllHitsCommand(
            //             program
            //         ).toHotCommand(),
            //         sp0: { name: "---------" },
            //         row_above: {},
            //         row_below: {},
            //         sp1: { name: "---------" },
            //         remove_row: {},
            //         remove_col: {},
            //         sp2: { name: "---------" },
            //         undo: {},
            //         redo: {},
            //         sp3: { name: "---------" },
            //         copy: {},
            //         cut: {},
            //     },
            // },
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

    async getData() {
        const json = (await this.context.admin.getJSON(
            "/admin/api/variable-annotations"
        )) as VariableAnnotationsResponse
        runInAction(() => {
            this.richDataRows = json.variables.map(parseVariableAnnotationsRow)
            this.numTotalRows = json.numTotalRows
        })
    }

    async getFieldDefinitions() {
        const json = await this.context.admin.getJSON(
            "https://owid.nyc3.digitaloceanspaces.com/schemas/grapher-schema.v001.json"
        )
        const fieldDescriptions = extractFieldDescriptionsFromSchema(json)
        runInAction(() => {
            this.fieldDescriptions = fieldDescriptions
        })
    }

    render() {
        const { hotSettings } = this
        if (hotSettings === undefined) return <div>Loading</div>
        else
            return (
                <HotTable
                    settings={this.hotSettings}
                    //ref={this.hotTableComponent as any}
                    licenseKey={"non-commercial-and-evaluation"}
                />
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

@observer
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
