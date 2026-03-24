import { Component } from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    runInAction,
    autorun,
    IReactionDisposer,
    makeObservable,
} from "mobx"
import YAML from "yaml"
import * as _ from "lodash-es"
import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import { FieldsRow, TextAreaField, CatalogPathField } from "./Forms.js"
import {
    OwidVariableWithDataAndSource,
    DimensionProperty,
    getETLPathComponents,
    OwidOrigin,
} from "@ourworldindata/utils"
import { ChartList, ChartListItem } from "./ChartList.js"
import { OriginList } from "./OriginList.js"
import { SourceList } from "./SourceList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import {
    GRAPHER_TAB_CONFIG_OPTIONS,
    GrapherInterface,
} from "@ourworldindata/types"
import {
    fetchInputTableForConfig,
    Grapher,
    GrapherState,
    loadCatalogData,
} from "@ourworldindata/grapher"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { CATALOG_URL, DATA_API_URL } from "../settings/clientSettings.js"

interface VariablePageData extends Omit<
    OwidVariableWithDataAndSource,
    "source"
> {
    datasetNamespace: string
    charts: ChartListItem[]
    grapherConfig: GrapherInterface | undefined
    grapherConfigETL: GrapherInterface | undefined
    grapherConfigAdmin: GrapherInterface | undefined
    source: { id: number; name: string }
    origins: OwidOrigin[]
}

// Simple read-only field component for displaying metadata values
function ReadOnlyField({
    label,
    value,
    textarea,
    rows,
}: {
    label: string
    value: string | number | undefined | null
    textarea?: boolean
    rows?: number
}) {
    const displayValue = value?.toString() ?? ""
    if (textarea) {
        return (
            <TextAreaField
                label={label}
                value={displayValue}
                disabled
                rows={rows}
            />
        )
    }
    return (
        <div className="form-group">
            <label>{label}</label>
            <input
                type="text"
                className="form-control"
                value={displayValue}
                disabled
            />
        </div>
    )
}

// XXX refactor with DatasetEditPage
@observer
class VariableEditor extends Component<{
    variable: VariablePageData
}> {
    constructor(props: { variable: VariablePageData }) {
        super(props)

        makeObservable(this, {
            grapherState: observable.ref,
        })
    }

    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    grapherState: GrapherState | undefined = undefined

    @computed get configUrlParams() {
        if (!this.grapherState) return undefined

        const grapherConfigJson = JSON.stringify(this.grapherState.object)
        const params = new URLSearchParams({ config: grapherConfigJson })
        return params.toString()
    }

    override render() {
        const { variable } = this.props

        const pathFragments = variable.catalogPath
            ? getETLPathComponents(variable.catalogPath)
            : undefined

        const isV2MetadataVariable = (variable?.schemaVersion ?? 1) >= 2

        const grapherConfigAdminYAML = YAML.stringify(
            variable.grapherConfigAdmin
        )

        return (
            <main className="VariableEditPage">
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
                                Open the metadata.yaml file:
                                <a
                                    href={`https://github.com/owid/etl/blob/master/etl/steps/data/garden/${pathFragments?.producer}/${pathFragments?.version}/${pathFragments?.table}.meta.yml`}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    {" "}
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
                                ,{" "}
                                <a
                                    href={`https://github.com/owid/etl/blob/master/etl/steps/data/grapher/${pathFragments?.producer}/${pathFragments?.version}/${pathFragments?.table}.meta.override.yml`}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    override
                                </a>
                                .{" "}
                                <small>
                                    (opens on master branch - switch as needed
                                    in the Github UI)
                                </small>
                            </p>
                            <h4>General</h4>
                            <ReadOnlyField
                                label="Indicator Name"
                                value={variable.name}
                            />
                            <CatalogPathField
                                catalogPath={variable.catalogPath}
                            />
                            <ReadOnlyField
                                label="Display name"
                                value={variable.display?.name}
                            />
                            <FieldsRow>
                                <ReadOnlyField
                                    label="Unit of measurement"
                                    value={
                                        variable.display?.unit ?? variable.unit
                                    }
                                />
                                <ReadOnlyField
                                    label="Short (axis) unit"
                                    value={
                                        variable.display?.shortUnit ??
                                        variable.shortUnit
                                    }
                                />
                                <ReadOnlyField
                                    label="Unit conversion factor"
                                    value={variable.display?.conversionFactor}
                                />
                            </FieldsRow>
                            <FieldsRow>
                                <ReadOnlyField
                                    label="Rounding mode"
                                    value={
                                        variable.display?.roundingMode
                                            ? _.startCase(
                                                  variable.display.roundingMode
                                              )
                                            : "Decimal Places"
                                    }
                                />
                                <ReadOnlyField
                                    label="Number of decimal places"
                                    value={variable.display?.numDecimalPlaces}
                                />
                                <ReadOnlyField
                                    label="Number of significant figures"
                                    value={
                                        variable.display?.numSignificantFigures
                                    }
                                />
                            </FieldsRow>
                            <FieldsRow>
                                <ReadOnlyField
                                    label="Treat year column as day series"
                                    value={
                                        variable.display?.yearIsDay
                                            ? "Yes"
                                            : "No"
                                    }
                                />
                                <ReadOnlyField
                                    label="Zero Day as YYYY-MM-DD"
                                    value={variable.display?.zeroDay}
                                />
                            </FieldsRow>
                        </section>
                    </div>
                    {this.grapherState && (
                        <div className="col">
                            <div className="topbar">
                                <h3>Preview</h3>
                                <Link
                                    className="btn btn-secondary"
                                    to={`/charts/create?${this.configUrlParams}`}
                                >
                                    Edit as new chart
                                </Link>
                            </div>
                            <Grapher grapherState={this.grapherState} />
                        </div>
                    )}
                </div>
                <div className="row">
                    <div className="col">
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
                                <ReadOnlyField
                                    label="Title public"
                                    value={variable.presentation?.titlePublic}
                                />
                                <ReadOnlyField
                                    label="Title variant"
                                    value={variable.presentation?.titleVariant}
                                />
                                <ReadOnlyField
                                    label="Attribution"
                                    value={variable.presentation?.attribution}
                                />
                                <ReadOnlyField
                                    label="Attribution short"
                                    value={
                                        variable.presentation?.attributionShort
                                    }
                                />
                            </FieldsRow>
                            <FieldsRow>
                                <ReadOnlyField
                                    label="Description short"
                                    value={variable.descriptionShort}
                                    textarea
                                />
                                <ReadOnlyField
                                    label="Description from producer"
                                    value={variable.descriptionFromProducer}
                                    textarea
                                />
                            </FieldsRow>
                            <FieldsRow>
                                <ReadOnlyField
                                    label="Description key"
                                    value={
                                        variable.descriptionKey?.join("\n") ??
                                        ""
                                    }
                                    textarea
                                    rows={8}
                                />
                                <ReadOnlyField
                                    label="Description processing"
                                    value={variable.descriptionProcessing}
                                    textarea
                                    rows={8}
                                />
                            </FieldsRow>
                            <FieldsRow>
                                <div className="col">
                                    <ReadOnlyField
                                        label="Processing Level"
                                        value={variable.processingLevel}
                                    />
                                    <ReadOnlyField
                                        label="Number of days between OWID updates"
                                        value={variable.updatePeriodDays}
                                    />
                                </div>
                            </FieldsRow>

                            <h4>Other metadata</h4>
                            <FieldsRow>
                                <ReadOnlyField
                                    label="Include in table"
                                    value={
                                        (variable.display?.includeInTable ??
                                        true)
                                            ? "Yes"
                                            : "No"
                                    }
                                />
                            </FieldsRow>
                            <FieldsRow>
                                <ReadOnlyField
                                    label="Description"
                                    value={variable.description}
                                    textarea
                                />
                                <ReadOnlyField
                                    label="Entity annotations"
                                    value={
                                        variable.display?.entityAnnotationsMap
                                    }
                                    textarea
                                />
                            </FieldsRow>
                        </section>
                    </div>
                </div>
                <hr></hr>
                <div className="row">
                    <div className="col">
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
                            <OriginList origins={variable.origins || []} />
                        </section>
                    </div>
                </div>
                {variable.source && (
                    <section>
                        <h3>Source</h3>
                        <SourceList sources={[variable.source]} />
                    </section>
                )}
                <section className="partial-grapher-configs">
                    <h3>Partial Grapher Config</h3>
                    <FieldsRow>
                        <TextAreaField
                            label="Grapher Config (edited via the ETL)"
                            value={YAML.stringify(variable.grapherConfigETL)}
                            disabled
                            rows={8}
                        />
                        <div>
                            <TextAreaField
                                key={grapherConfigAdminYAML}
                                label="Grapher Config (edited in the admin)"
                                value={grapherConfigAdminYAML}
                                disabled
                                rows={8}
                            />
                            <a
                                className="btn btn-primary"
                                href={`/admin/variables/${variable.id}/config`}
                                target="_blank"
                                rel="noopener"
                            >
                                {variable.grapherConfigAdmin
                                    ? "Edit"
                                    : "Create"}
                            </a>
                            {variable.grapherConfigAdmin && (
                                <button
                                    type="button"
                                    className="btn btn-danger ml-2"
                                    onClick={async () => {
                                        if (
                                            !window.confirm(
                                                `Are you sure you want to delete the admin-authored Grapher config for variable ${variable.id}? This action cannot be undone!`
                                            )
                                        )
                                            return

                                        const json =
                                            await this.context.admin.requestJSON(
                                                `/api/variables/${variable.id}/grapherConfigAdmin`,
                                                {},
                                                "DELETE"
                                            )

                                        if (json.success) {
                                            runInAction(
                                                () =>
                                                    (this.props.variable.grapherConfigAdmin =
                                                        undefined)
                                            )
                                        }
                                    }}
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </FieldsRow>
                </section>
                <hr></hr>
                <section>
                    <h3>Charts</h3>
                    <ChartList charts={variable.charts} />
                </section>
            </main>
        )
    }

    @computed private get grapherConfig(): GrapherInterface {
        const { variable } = this.props
        const grapherConfig = variable.grapherConfig
        if (grapherConfig)
            return {
                ...grapherConfig,
                hasMapTab: true,
                tab: GRAPHER_TAB_CONFIG_OPTIONS.map,
            }
        else
            return {
                yAxis: { min: 0 },
                map: { columnSlug: this.props.variable.id.toString() },
                tab: GRAPHER_TAB_CONFIG_OPTIONS.map,
                hasMapTab: true,
                dimensions: [
                    {
                        property: DimensionProperty.y,
                        variableId: this.props.variable.id,
                        display: _.clone(variable.display),
                    },
                ],
            }
    }

    dispose!: IReactionDisposer
    override componentDidMount() {
        this.grapherState = new GrapherState({
            ...this.grapherConfig,
            additionalDataLoaderFn: (catalogKey) =>
                loadCatalogData(catalogKey, { baseUrl: CATALOG_URL }),
        })
        void fetchInputTableForConfig({
            dimensions: this.grapherConfig.dimensions,
            selectedEntityColors: this.grapherConfig.selectedEntityColors,
            dataApiUrl: DATA_API_URL,
            noCache: true,
        }).then((inputTable) => {
            if (inputTable) this.grapherState!.inputTable = inputTable
        })

        this.dispose = autorun(() => {
            if (this.grapherState && this.grapherConfig) {
                this.grapherState.updateFromObject(this.grapherConfig)
            }
        })
    }

    override componentWillUnmount() {
        this.dispose()
    }
}

@observer
export class VariableEditPage extends Component<{ variableId: number }> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    variable: VariablePageData | undefined = undefined

    constructor(props: { variableId: number }) {
        super(props)

        makeObservable(this, {
            variable: observable,
        })
    }

    override render() {
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

    override componentDidMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    override UNSAFE_componentWillReceiveProps() {
        void this.getData()
    }
}
