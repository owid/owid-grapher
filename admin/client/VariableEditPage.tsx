import { ChartConfig } from "charts/ChartConfig"
import { VariableDisplaySettings } from "charts/VariableData"
import { Base64 } from "js-base64"
import * as _ from "lodash"
import {
    autorun,
    computed,
    IReactionDisposer,
    observable,
    runInAction
} from "mobx"
import { observer } from "mobx-react"
import * as React from "react"
import { Prompt, Redirect } from "react-router-dom"
import { ChartFigureView } from "site/client/ChartFigureView"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { AdminLayout } from "./AdminLayout"
import { ChartList, ChartListItem } from "./ChartList"
import { BindFloat, BindString, FieldsRow } from "./Forms"
import { Link } from "./Link"

interface VariablePageData {
    id: number
    name: string
    unit: string
    shortUnit: string
    description: string
    display: VariableDisplaySettings

    datasetId: number
    datasetName: string
    datasetNamespace: string

    charts: ChartListItem[]
    source: { id: number; name: string }
}

class VariableEditable {
    @observable name: string = ""
    @observable unit: string = ""
    @observable shortUnit: string = ""
    @observable description: string = ""
    @observable display: VariableDisplaySettings = new VariableDisplaySettings()

    constructor(json: any) {
        for (const key in this) {
            if (key === "display") _.extend(this.display, json.display)
            else this[key] = json[key]
        }
    }
}

// XXX refactor with DatasetEditPage
@observer
class VariableEditor extends React.Component<{ variable: VariablePageData }> {
    @observable newVariable!: VariableEditable
    @observable isDeleted: boolean = false

    // Store the original dataset to determine when it is modified
    componentWillMount() {
        this.componentWillReceiveProps()
    }
    componentWillReceiveProps() {
        this.newVariable = new VariableEditable(this.props.variable)
        this.isDeleted = false
    }

    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable.ref chart?: ChartConfig

    @computed get isModified(): boolean {
        return (
            JSON.stringify(this.newVariable) !==
            JSON.stringify(new VariableEditable(this.props.variable))
        )
    }

    async delete() {
        const { variable } = this.props
        if (
            !window.confirm(
                `Really delete the variable ${variable.name}? This action cannot be undone!`
            )
        )
            return

        const json = await this.context.admin.requestJSON(
            `/api/variables/${variable.id}`,
            {},
            "DELETE"
        )

        if (json.success) {
            this.isDeleted = true
        }
    }

    render() {
        const { variable } = this.props
        const { newVariable } = this
        const isBulkImport = variable.datasetNamespace !== "owid"

        if (this.isDeleted)
            return <Redirect to={`/datasets/${variable.datasetId}`} />

        return (
            <main className="VariableEditPage">
                <Prompt
                    when={this.isModified}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                        {variable.datasetNamespace}
                    </li>
                    <li className="breadcrumb-item">
                        <Link to={`/datasets/${variable.datasetId}`}>
                            {variable.datasetName}
                        </Link>
                    </li>
                    <li className="breadcrumb-item active">{variable.name}</li>
                </ol>
                <div className="row">
                    <div className="col">
                        <form
                            onSubmit={e => {
                                e.preventDefault()
                                this.save()
                            }}
                        >
                            <section>
                                <h3>Variable metadata</h3>
                                {isBulkImport ? (
                                    <p>
                                        This variable came from an automated
                                        import, so we can't change the original
                                        metadata manually.
                                    </p>
                                ) : (
                                    <p>
                                        The core metadata for the variable. It's
                                        important to keep this consistent.
                                    </p>
                                )}
                                <BindString
                                    field="name"
                                    store={newVariable}
                                    label="Variable Name"
                                    disabled={isBulkImport}
                                />
                                <BindString
                                    label="Display name"
                                    field="name"
                                    store={newVariable.display}
                                />
                                <FieldsRow>
                                    <BindString
                                        label="Unit of measurement"
                                        field="unit"
                                        store={newVariable.display}
                                    />
                                    <BindString
                                        label="Short (axis) unit"
                                        field="shortUnit"
                                        store={newVariable.display}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <BindFloat
                                        label="Number of decimal places"
                                        field="numDecimalPlaces"
                                        store={newVariable.display}
                                        helpText={`A negative number here will round integers`}
                                    />
                                    <BindFloat
                                        label="Unit conversion factor"
                                        field="conversionFactor"
                                        store={newVariable.display}
                                        helpText={`Multiply all values by this amount`}
                                    />
                                </FieldsRow>
                                <BindString
                                    field="description"
                                    store={newVariable}
                                    label="Description"
                                    textarea
                                    disabled={isBulkImport}
                                />
                            </section>
                            <input
                                type="submit"
                                className="btn btn-success"
                                value="Update variable"
                            />
                        </form>
                    </div>
                    {this.chart && (
                        <div className="col">
                            <div className="topbar">
                                <h3>Preview</h3>
                                <Link
                                    className="btn btn-secondary"
                                    to={`/charts/create/${Base64.encode(
                                        JSON.stringify(this.chart.json)
                                    )}`}
                                >
                                    Edit as new chart
                                </Link>
                            </div>
                            <ChartFigureView chart={this.chart} />
                        </div>
                    )}
                </div>
                <section>
                    <h3>Charts</h3>
                    <ChartList charts={variable.charts} />
                </section>
            </main>
        )
    }

    async save() {
        const { variable } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/variables/${variable.id}`,
            { variable: this.newVariable },
            "PUT"
        )

        if (json.success) {
            Object.assign(this.props.variable, this.newVariable)
        }
    }

    @computed get chartConfig() {
        return {
            yAxis: { min: 0 },
            map: { variableId: this.props.variable.id },
            tab: "map",
            hasMapTab: true,
            dimensions: [
                {
                    property: "y",
                    variableId: this.props.variable.id,
                    display: _.clone(this.newVariable.display)
                }
            ]
        }
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.chart = new ChartConfig(this.chartConfig as any)

        this.dispose = autorun(() => {
            if (this.chart && this.chartConfig) {
                this.chart.update(this.chartConfig)
            }
        })
    }

    componentWillUnmount() {
        this.dispose()
    }
}

@observer
export class VariableEditPage extends React.Component<{ variableId: number }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable variable?: VariablePageData

    render() {
        return (
            <AdminLayout>
                {this.variable && <VariableEditor variable={this.variable} />}
            </AdminLayout>
        )
    }

    async getData() {
        const json = await this.context.admin.getJSON(
            `/api/variables/${this.props.variableId}.json`
        )
        runInAction(() => {
            this.variable = json.variable as VariablePageData
        })
    }

    componentDidMount() {
        this.componentWillReceiveProps()
    }
    componentWillReceiveProps() {
        this.getData()
    }
}
