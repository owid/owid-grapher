import * as React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    runInAction,
    autorun,
    IReactionDisposer,
} from "mobx"
import * as lodash from "lodash"
import { Prompt, Redirect } from "react-router-dom"
import { AdminLayout } from "./AdminLayout"
import { Link } from "./Link"
import { BindString, BindFloat, FieldsRow, Toggle } from "./Forms"
import {
    LegacyVariableConfig,
    LegacyVariableDisplayConfig,
} from "grapher/core/LegacyVariableCode"
import { Grapher } from "grapher/core/Grapher"
import { GrapherFigureView } from "site/client/GrapherFigureView"
import { ChartList, ChartListItem } from "./ChartList"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { Base64 } from "js-base64"
import {
    DimensionProperty,
    EPOCH_DATE,
    GrapherTabOption,
} from "grapher/core/GrapherConstants"
import { GrapherInterface } from "grapher/core/GrapherInterface"

interface VariablePageData extends Omit<LegacyVariableConfig, "source"> {
    datasetNamespace: string
    charts: ChartListItem[]
    source: { id: number; name: string }
}

class VariableEditable implements Omit<LegacyVariableConfig, "id"> {
    @observable name = ""
    @observable unit = ""
    @observable shortUnit = ""
    @observable description = ""
    @observable entityAnnotationsMap = ""
    @observable display = new LegacyVariableDisplayConfig()

    constructor(json: any) {
        for (const key in this) {
            if (key === "display") lodash.extend(this.display, json.display)
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

    @observable.ref grapher?: Grapher

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
                            onSubmit={(e) => {
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
                                        placeholder={newVariable.unit}
                                    />
                                    <BindString
                                        label="Short (axis) unit"
                                        field="shortUnit"
                                        store={newVariable.display}
                                        placeholder={newVariable.shortUnit}
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
                                <FieldsRow>
                                    <Toggle
                                        value={
                                            newVariable.display.yearIsDay ===
                                            true
                                        }
                                        onValue={(value) =>
                                            (newVariable.display.yearIsDay = value)
                                        }
                                        label="Treat year column as day series"
                                    />
                                    <BindString
                                        label="Zero Day as YYYY-MM-DD"
                                        field="zeroDay"
                                        store={newVariable.display}
                                        disabled={
                                            !newVariable.display.yearIsDay
                                        }
                                        placeholder={
                                            newVariable.display.yearIsDay
                                                ? EPOCH_DATE
                                                : ""
                                        }
                                        helpText={`The day series starts on this date.`}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <Toggle
                                        value={
                                            newVariable.display
                                                .includeInTable === true
                                        }
                                        onValue={(value) =>
                                            (newVariable.display.includeInTable = value)
                                        }
                                        label="Include in table"
                                    />
                                </FieldsRow>
                                <BindString
                                    field="description"
                                    store={newVariable}
                                    label="Description"
                                    textarea
                                    disabled={isBulkImport}
                                />
                                <BindString
                                    field="entityAnnotationsMap"
                                    placeholder="Entity: note"
                                    store={newVariable.display}
                                    label="Entity annotations"
                                    textarea
                                    disabled={isBulkImport}
                                    helpText="Additional text to show next to entity labels. Each note should be in a separate line."
                                />
                            </section>
                            <input
                                type="submit"
                                className="btn btn-success"
                                value="Update variable"
                            />
                        </form>
                    </div>
                    {this.grapher && (
                        <div className="col">
                            <div className="topbar">
                                <h3>Preview</h3>
                                <Link
                                    className="btn btn-secondary"
                                    to={`/charts/create/${Base64.encode(
                                        JSON.stringify(this.grapher.object)
                                    )}`}
                                >
                                    Edit as new chart
                                </Link>
                            </div>
                            <GrapherFigureView grapher={this.grapher} />
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

    @computed private get grapherConfig(): GrapherInterface {
        return {
            yAxis: { min: 0 },
            map: { columnSlug: this.props.variable.id.toString() },
            tab: GrapherTabOption.map,
            hasMapTab: true,
            dimensions: [
                {
                    property: DimensionProperty.y,
                    variableId: this.props.variable.id,
                    display: lodash.clone(this.newVariable.display),
                },
            ],
        }
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.grapher = new Grapher(this.grapherConfig)

        this.dispose = autorun(() => {
            if (this.grapher && this.grapherConfig) {
                this.grapher.updateFromObject(this.grapherConfig)
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
