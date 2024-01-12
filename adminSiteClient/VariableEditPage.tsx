import React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    runInAction,
    autorun,
    IReactionDisposer,
} from "mobx"
import { dump } from "js-yaml"
import * as lodash from "lodash"
import { Prompt, Redirect } from "react-router-dom"
import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import { BindString, BindFloat, FieldsRow, Toggle } from "./Forms.js"
import {
    OwidVariableWithDataAndSource,
    OwidVariableDisplayConfig,
    OwidVariablePresentation,
    DimensionProperty,
    EPOCH_DATE,
    getETLPathComponents,
    OwidProcessingLevel,
    OwidOrigin,
    OwidSource,
} from "@ourworldindata/utils"
import { GrapherFigureView } from "../site/GrapherFigureView.js"
import { ChartList, ChartListItem } from "./ChartList.js"
import { OriginList } from "./OriginList.js"
import { SourceList } from "./SourceList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { Base64 } from "js-base64"
import { GrapherTabOption, GrapherInterface } from "@ourworldindata/types"
import { Grapher } from "@ourworldindata/grapher"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

interface VariablePageData
    extends Omit<OwidVariableWithDataAndSource, "source"> {
    datasetNamespace: string
    charts: ChartListItem[]
    grapherConfig: GrapherInterface | undefined
    source: { id: number; name: string }
    origins: OwidOrigin[]
}

const createBulletList = (items: string[]): string => {
    return items.map((item) => `• ${item}`).join("\n")
}

class VariableEditable
    implements
        Omit<
            OwidVariableWithDataAndSource,
            "id" | "values" | "years" | "entities"
        >
{
    @observable name = ""
    @observable unit = ""
    @observable shortUnit = ""
    @observable description = ""
    @observable entityAnnotationsMap = ""
    @observable display = new OwidVariableDisplayConfig()

    @observable descriptionShort = ""
    @observable descriptionFromProducer = ""
    @observable descriptionKey: string[] = []
    @observable descriptionProcessing = ""
    @observable processingLevel: OwidProcessingLevel | undefined = undefined

    @observable presentation = {} as OwidVariablePresentation

    @observable updatePeriodDays: number | undefined = undefined

    @observable origins: OwidOrigin[] = []

    @observable source: OwidSource | undefined = undefined

    constructor(json: any) {
        for (const key in this) {
            if (key === "display") lodash.extend(this.display, json.display)
            else if (key === "presentation")
                lodash.extend(this.presentation, json.presentation)
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
    UNSAFE_componentWillMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    UNSAFE_componentWillReceiveProps() {
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

    render() {
        const { variable } = this.props
        const { newVariable, isV2MetadataVariable } = this
        const isDisabled = true

        const pathFragments = variable.catalogPath
            ? getETLPathComponents(variable.catalogPath)
            : undefined

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
                        <form>
                            <section>
                                <h3>Indicator metadata</h3>
                                {isV2MetadataVariable && (
                                    <>
                                        <a
                                            href={`/admin/datapage-preview/${variable.id}`}
                                        >
                                            View data page
                                        </a>
                                        <br></br>
                                    </>
                                )}

                                <p>
                                    Metadata is non-editable and can be only
                                    changed in ETL.
                                </p>
                                <p>
                                    Open the metadata.yaml file:
                                    <a
                                        href={`https://github.com/owid/etl/blob/master/etl/steps/data/garden/${pathFragments?.producer}/${pathFragments?.version}/${pathFragments?.table}.meta.yml`}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        garden level
                                    </a>
                                    ,{" "}
                                    <a
                                        href={`https://github.com/owid/etl/blob/master/etl/steps/data/grapher/${pathFragments?.producer}/${pathFragments?.version}/${pathFragments?.table}.meta.yml`}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        grapher level
                                    </a>
                                    .{" "}
                                    <small>
                                        (opens on master branch - switch as
                                        needed in the Github UI)
                                    </small>
                                </p>
                                <h4>General</h4>
                                <BindString
                                    field="name"
                                    store={newVariable}
                                    label="Indicator Name"
                                    disabled={isDisabled}
                                />
                                <BindString
                                    field="catalogPath"
                                    store={variable}
                                    label="ETL path"
                                    disabled={true}
                                />
                                <BindString
                                    label="Display name"
                                    field="name"
                                    store={newVariable.display}
                                    disabled={isDisabled}
                                />
                                <FieldsRow>
                                    <BindString
                                        label="Unit of measurement"
                                        field="unit"
                                        store={newVariable.display}
                                        placeholder={newVariable.unit}
                                        disabled={isDisabled}
                                    />
                                    <BindString
                                        label="Short (axis) unit"
                                        field="shortUnit"
                                        store={newVariable.display}
                                        placeholder={newVariable.shortUnit}
                                        disabled={isDisabled}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <BindFloat
                                        label="Number of decimal places"
                                        field="numDecimalPlaces"
                                        store={newVariable.display}
                                        helpText={`A negative number here will round integers`}
                                        disabled={isDisabled}
                                    />
                                    <BindFloat
                                        label="Unit conversion factor"
                                        field="conversionFactor"
                                        store={newVariable.display}
                                        helpText={`Multiply all values by this amount`}
                                        disabled={isDisabled}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <Toggle
                                        value={
                                            newVariable.display.yearIsDay ===
                                            true
                                        }
                                        onValue={(value) =>
                                            (newVariable.display.yearIsDay =
                                                value)
                                        }
                                        label="Treat year column as day series"
                                        disabled={isDisabled}
                                    />
                                    <BindString
                                        label="Zero Day as YYYY-MM-DD"
                                        field="zeroDay"
                                        store={newVariable.display}
                                        // disabled={
                                        //     !newVariable.display.yearIsDay
                                        // }
                                        disabled={isDisabled}
                                        placeholder={
                                            newVariable.display.yearIsDay
                                                ? EPOCH_DATE
                                                : ""
                                        }
                                        helpText={`The day series starts on this date.`}
                                    />
                                </FieldsRow>
                            </section>
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
                <div className="row">
                    <div className="col">
                        <form>
                            <section>
                                <h4>
                                    Data Page&nbsp;
                                    <a href="https://docs.owid.io/projects/etl/architecture/metadata/reference/indicator/">
                                        <FontAwesomeIcon
                                            icon={faCircleInfo}
                                            className="text-muted"
                                        />
                                    </a>
                                </h4>

                                <FieldsRow>
                                    <BindString
                                        label="Title public"
                                        field="titlePublic"
                                        store={newVariable.presentation}
                                        disabled={isDisabled}
                                    />
                                    <BindString
                                        label="Title variant"
                                        field="titleVariant"
                                        store={newVariable.presentation}
                                        disabled={isDisabled}
                                    />
                                    <BindString
                                        label="Attribution"
                                        field="attribution"
                                        store={newVariable.presentation}
                                        disabled={isDisabled}
                                    />
                                    <BindString
                                        label="Attribution short"
                                        field="attributionShort"
                                        store={newVariable.presentation}
                                        disabled={isDisabled}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <BindString
                                        label="Description short"
                                        field="descriptionShort"
                                        store={newVariable}
                                        disabled={isDisabled}
                                        textarea
                                    />
                                    <BindString
                                        label="Description from producer"
                                        field="descriptionFromProducer"
                                        store={newVariable}
                                        disabled={isDisabled}
                                        textarea
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <BindString
                                        label="Grapher Config ETL"
                                        field="v"
                                        store={{
                                            v: dump(
                                                newVariable.presentation
                                                    .grapherConfigETL
                                            ),
                                        }}
                                        disabled={isDisabled}
                                        textarea
                                        rows={8}
                                    />
                                    <BindString
                                        label="Description key"
                                        field="v"
                                        store={{
                                            v: createBulletList(
                                                newVariable.descriptionKey || []
                                            ),
                                        }}
                                        disabled={isDisabled}
                                        textarea
                                        rows={8}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <div className="col">
                                        <BindString
                                            label="Description processing"
                                            field="descriptionProcessing"
                                            store={newVariable}
                                            disabled={isDisabled}
                                            textarea
                                            rows={8}
                                        />
                                    </div>
                                    <div className="col">
                                        <BindString
                                            label="Processing level"
                                            field="processingLevel"
                                            store={newVariable}
                                            disabled={isDisabled}
                                        />
                                        <BindString
                                            label="Number of days between OWID updates"
                                            field="updatePeriodDays"
                                            store={newVariable}
                                            disabled={isDisabled}
                                        />
                                    </div>
                                </FieldsRow>

                                <h4>Other metadata</h4>
                                <FieldsRow>
                                    <Toggle
                                        value={
                                            newVariable.display
                                                .includeInTable === true
                                        }
                                        onValue={(value) =>
                                            (newVariable.display.includeInTable =
                                                value)
                                        }
                                        label="Include in table"
                                        disabled={isDisabled}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <BindString
                                        field="description"
                                        store={newVariable}
                                        label="Description"
                                        textarea
                                        disabled={isDisabled}
                                    />
                                    <BindString
                                        field="entityAnnotationsMap"
                                        placeholder="Entity: note"
                                        store={newVariable.display}
                                        label="Entity annotations"
                                        textarea
                                        disabled={isDisabled}
                                        helpText="Additional text to show next to entity labels. Each note should be in a separate line."
                                    />
                                </FieldsRow>
                            </section>
                        </form>
                    </div>
                </div>
                <div className="row">
                    <div className="col">
                        <form>
                            <section>
                                <h3>
                                    Origins&nbsp;
                                    <a href="https://docs.owid.io/projects/etl/architecture/metadata/reference/origin/">
                                        <FontAwesomeIcon
                                            icon={faCircleInfo}
                                            className="text-muted"
                                        />
                                    </a>
                                </h3>
                                <OriginList
                                    origins={newVariable.origins || []}
                                />
                            </section>
                        </form>
                    </div>
                </div>
                {newVariable.source && (
                    <section>
                        <form>
                            <h3>Source</h3>
                            <SourceList sources={[newVariable.source]} />
                        </form>
                    </section>
                )}
                <section>
                    <h3>Charts</h3>
                    <ChartList charts={variable.charts} />
                </section>
            </main>
        )
    }

    @computed private get isV2MetadataVariable(): boolean {
        const { variable } = this.props

        return (variable?.schemaVersion ?? 1) >= 2
    }

    @computed private get grapherConfig(): GrapherInterface {
        const { variable } = this.props
        const grapherConfig = variable.grapherConfig
        if (grapherConfig)
            return {
                ...grapherConfig,
                hasMapTab: true,
                tab: GrapherTabOption.map,
            }
        else
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
        this.UNSAFE_componentWillReceiveProps()
    }
    UNSAFE_componentWillReceiveProps() {
        this.getData()
    }
}
