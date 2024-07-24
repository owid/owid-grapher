import React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    runInAction,
    autorun,
    IReactionDisposer,
} from "mobx"
import YAML from "yaml"
import * as lodash from "lodash"
import { Prompt, Redirect } from "react-router-dom"
import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import {
    BindString,
    BindStringArray,
    BindFloat,
    FieldsRow,
    BindDropdown,
    Toggle,
    SelectField,
} from "./Forms.js"
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
    stringifyUnknownError,
    startCase,
} from "@ourworldindata/utils"
import { GrapherFigureView } from "../site/GrapherFigureView.js"
import { ChartList, ChartListItem } from "./ChartList.js"
import { OriginList } from "./OriginList.js"
import { SourceList } from "./SourceList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { Base64 } from "js-base64"
import {
    GrapherTabOption,
    GrapherInterface,
    OwidVariableRoundingMode,
} from "@ourworldindata/types"
import { Grapher } from "@ourworldindata/grapher"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { DATA_API_URL, ETL_API_URL } from "../settings/clientSettings.js"
import _ from "lodash"

interface VariablePageData
    extends Omit<OwidVariableWithDataAndSource, "source"> {
    datasetNamespace: string
    charts: ChartListItem[]
    grapherConfig: GrapherInterface | undefined
    source: { id: number; name: string }
    origins: OwidOrigin[]
}

// Calculates the difference between two objects, including nested objects.
const getDifference = <T extends object>(object: T, base: T): Partial<T> => {
    const changes = (obj: any, baseObj: any): any => {
        return _.transform(obj, (result: any, value: any, key: keyof any) => {
            if (_.isArray(value) && _.isArray(baseObj[key])) {
                // If both are arrays and not equal, return the entire array
                if (!_.isEqual(value, baseObj[key])) {
                    result[key] = value
                }
            } else if (!_.isEqual(value, baseObj[key])) {
                // For non-array values
                result[key] =
                    _.isObject(value) && _.isObject(baseObj[key])
                        ? changes(value, baseObj[key])
                        : value
            }
        })
    }
    return changes(object, base)
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
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        void this.save()
                    }}
                >
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
                                        (opens on master branch - switch as
                                        needed in the Github UI)
                                    </small>
                                </p>
                                <h4>General</h4>
                                <BindString
                                    field="name"
                                    store={newVariable}
                                    label="Indicator Name"
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
                                    <BindFloat
                                        label="Unit conversion factor"
                                        field="conversionFactor"
                                        store={newVariable.display}
                                        helpText={`Multiply all values by this amount`}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <SelectField
                                        label="Rounding mode"
                                        value={variable.display?.roundingMode}
                                        onValue={(value) => {
                                            const roundingMode =
                                                value as OwidVariableRoundingMode
                                            newVariable.display.roundingMode =
                                                roundingMode !==
                                                OwidVariableRoundingMode.decimalPlaces
                                                    ? roundingMode
                                                    : undefined
                                        }}
                                        options={Object.keys(
                                            OwidVariableRoundingMode
                                        ).map((key) => ({
                                            value: key,
                                            label: startCase(key),
                                        }))}
                                    />
                                    <BindFloat
                                        label="Number of decimal places"
                                        field="numDecimalPlaces"
                                        store={newVariable.display}
                                    />
                                    <BindFloat
                                        label="Number of significant figures"
                                        field="numSignificantFigures"
                                        store={newVariable.display}
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
                                        disabled
                                    />
                                    <BindString
                                        label="Zero Day as YYYY-MM-DD"
                                        field="zeroDay"
                                        store={newVariable.display}
                                        // disabled={
                                        //     !newVariable.display.yearIsDay
                                        // }
                                        disabled
                                        placeholder={
                                            newVariable.display.yearIsDay
                                                ? EPOCH_DATE
                                                : ""
                                        }
                                        helpText={`The day series starts on this date.`}
                                    />
                                </FieldsRow>
                            </section>
                        </div>
                        {/* BUG: when user pres Enter when editing form, chart will switch to `Table` tab */}
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
                                <GrapherFigureView
                                    grapher={this.grapher}
                                    dataApiUrlForAdmin={
                                        this.context.admin?.settings
                                            ?.DATA_API_FOR_ADMIN_UI
                                    }
                                    // passed this way because clientSettings are baked and need a recompile to be updated
                                />
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
                                    <BindString
                                        label="Title public"
                                        field="titlePublic"
                                        store={newVariable.presentation}
                                    />
                                    <BindString
                                        label="Title variant"
                                        field="titleVariant"
                                        store={newVariable.presentation}
                                    />
                                    <BindString
                                        label="Attribution"
                                        field="attribution"
                                        store={newVariable.presentation}
                                    />
                                    <BindString
                                        label="Attribution short"
                                        field="attributionShort"
                                        store={newVariable.presentation}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <BindString
                                        label="Description short"
                                        field="descriptionShort"
                                        store={newVariable}
                                        textarea
                                    />
                                    <BindString
                                        label="Description from producer"
                                        field="descriptionFromProducer"
                                        store={newVariable}
                                        textarea
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <BindString
                                        label="Grapher Config ETL"
                                        field="v"
                                        store={{
                                            v: YAML.stringify(
                                                newVariable.presentation
                                                    .grapherConfigETL
                                            ),
                                        }}
                                        disabled
                                        textarea
                                        rows={8}
                                    />
                                    <BindStringArray
                                        label="Description key"
                                        field="descriptionKey"
                                        store={newVariable}
                                        rows={8}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <div className="col">
                                        <BindString
                                            label="Description processing"
                                            field="descriptionProcessing"
                                            store={newVariable}
                                            textarea
                                            rows={8}
                                        />
                                    </div>
                                    <div className="col">
                                        <BindDropdown
                                            label="Processing Level"
                                            field="processingLevel"
                                            store={newVariable}
                                            options={[
                                                {
                                                    value: "minor",
                                                    label: "Minor",
                                                },
                                                {
                                                    value: "major",
                                                    label: "Major",
                                                },
                                            ]}
                                        />
                                        <BindString
                                            label="Number of days between OWID updates"
                                            field="updatePeriodDays"
                                            store={newVariable}
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
                                        disabled
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <BindString
                                        field="description"
                                        store={newVariable}
                                        label="Description"
                                        textarea
                                        disabled
                                    />
                                    <BindString
                                        field="entityAnnotationsMap"
                                        placeholder="Entity: note"
                                        store={newVariable.display}
                                        label="Entity annotations"
                                        textarea
                                        disabled
                                        helpText="Additional text to show next to entity labels. Each note should be in a separate line."
                                    />
                                </FieldsRow>
                            </section>
                            <input
                                type="submit"
                                className="btn btn-success"
                                value="Update indicator"
                            />
                        </div>
                    </div>
                    <hr></hr>
                </form>
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

    async etlApiIsRunning(): Promise<boolean> {
        const healthcheckUrl = `${ETL_API_URL}/health`
        try {
            await this.context.admin.rawRequest(
                healthcheckUrl,
                undefined,
                "GET",
                undefined,
                "include"
            )
            return true
        } catch (err) {
            return false
        }
    }

    async save() {
        const { variable } = this.props

        this.context.admin.loadingIndicatorSetting = "loading"

        const url = `${ETL_API_URL}/indicators`

        const indicatorDiff = getDifference(
            this.newVariable,
            new VariableEditable(this.props.variable)
        )

        const data = {
            catalogPath: variable.catalogPath,
            indicator: indicatorDiff,
            dataApiUrl: DATA_API_URL,
            triggerETL: true,
        }

        const request = this.context.admin.rawRequest(
            url,
            JSON.stringify(data),
            "PUT",
            undefined,
            "include"
        )
        let response: Response
        try {
            response = await request
            this.context.admin.loadingIndicatorSetting = "off"
        } catch (err) {
            const title = (await this.etlApiIsRunning())
                ? `Internal error`
                : `Error - ETL API is not running on ${ETL_API_URL}`

            this.context.admin.setErrorMessage({
                title: title,
                content: JSON.stringify(
                    {
                        err: stringifyUnknownError(err),
                        url,
                        request: data,
                    },
                    null,
                    2
                ),
                isFatal: true,
            })
            this.context.admin.loadingIndicatorSetting = "off"
            throw err
        }

        if (response.status !== 200) {
            const text = await response.text()
            const json = JSON.parse(text)
            this.context.admin.setErrorMessage({
                title: `Validation error`,
                content: JSON.stringify(
                    {
                        url,
                        request: data,
                        response: json.detail,
                    },
                    null,
                    2
                ),
                isFatal: false,
            })
        } else {
            // success
            Object.assign(this.props.variable, _.cloneDeep(this.newVariable))
        }
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
        void this.getData()
    }
}
