/**
 * A page for trying the config-only chart editor: paste a grapher config,
 * edit it against the live preview, and read the edited config back. It is
 * the in-repo stand-in for what a consumer of the future editor package would
 * build, so it deliberately touches nothing chart-specific in the admin.
 *
 * Two data stores can be tried: OWID's Data API (configs reference indicators
 * by `variableId`) and a pasted CSV (configs reference columns by slug).
 */
import * as React from "react"
import { observer } from "mobx-react"
import { action, computed, observable, makeObservable } from "mobx"
import { Button, Drawer, Modal, Segmented, Space, Switch, Tabs } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCode, faCopy, faFileImport } from "@fortawesome/free-solid-svg-icons"
import {
    ColumnTypeNames,
    DimensionProperty,
    GrapherInterface,
    OwidColumnDef,
} from "@ourworldindata/types"
import { copyToClipboard } from "@ourworldindata/utils"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { GrapherEditor } from "./GrapherEditor.js"
import { EditorTab } from "./AbstractChartEditor.js"
import { DetailsProvider, IndicatorCatalog } from "./editorProviders.js"
import {
    adminDetailsProvider,
    adminEditorEnvironment,
    adminIndicatorCatalog,
} from "./adminEditorProviders.js"
import {
    csvIndicatorStore,
    dataApiIndicatorStore,
    IndicatorStore,
} from "./indicatorStores.js"

import "./EditorPlaygroundPage.scss"

// Life expectancy at birth, served by the public Data API, so the preview
// works against any database.
const EXAMPLE_API_CONFIG: GrapherInterface = {
    title: "Life expectancy",
    subtitle:
        "The period life expectancy at birth, in a given year. Try editing this.",
    hasMapTab: true,
    selectedEntityNames: ["World", "Africa", "Europe", "Asia"],
    dimensions: [{ property: DimensionProperty.y, variableId: 1118466 }],
}

// A made-up CSV standing in for a host's own data: no OWID indicators, the
// config references columns by slug.
const EXAMPLE_CSV = `entityName,year,rent_index,vacancy_rate
Berlin,2015,100,3.1
Berlin,2017,112,2.4
Berlin,2019,124,1.5
Berlin,2021,131,1.2
Berlin,2023,142,0.9
Vienna,2015,100,4.0
Vienna,2017,104,4.1
Vienna,2019,108,3.9
Vienna,2021,112,3.8
Vienna,2023,117,3.6
Prague,2015,100,3.5
Prague,2017,119,2.6
Prague,2019,141,1.9
Prague,2021,152,2.2
Prague,2023,160,1.7`

const EXAMPLE_CSV_COLUMN_DEFS: OwidColumnDef[] = [
    {
        slug: "rent_index",
        type: ColumnTypeNames.Numeric,
        name: "Rent index",
        unit: "index (2015 = 100)",
        description: "Average asking rent relative to 2015.",
        sourceName: "City statistics offices (made up for the playground)",
    },
    {
        slug: "vacancy_rate",
        type: ColumnTypeNames.Numeric,
        name: "Vacancy rate",
        unit: "%",
        shortUnit: "%",
        sourceName: "City statistics offices (made up for the playground)",
    },
]

const EXAMPLE_CSV_CONFIG: GrapherInterface = {
    title: "Rents in three cities",
    subtitle: "Asking rents relative to 2015. Data from a pasted CSV.",
    ySlugs: "rent_index",
    selectedEntityNames: ["Berlin", "Vienna", "Prague"],
}

const LITE_TABS: EditorTab[] = ["basic", "data", "text", "customize", "map"]

// From react-chart-editor's readme, for comparison in the "Show code" drawer.
const PLOTLY_SNIPPET = `import plotly from "plotly.js/dist/plotly"
import PlotlyEditor from "react-chart-editor"
import "react-chart-editor/lib/react-chart-editor.css"

const dataSources = {
    year: [2015, 2017, 2019],
    rent_index: [100, 112, 124],
}
const dataSourceOptions = Object.keys(dataSources).map((name) => ({
    value: name,
    label: name,
}))

<PlotlyEditor
    data={data}          // traces, each referencing columns by name (xsrc/ysrc)
    layout={layout}
    frames={frames}
    config={{ editable: true }}
    dataSources={dataSources}
    dataSourceOptions={dataSourceOptions}
    plotly={plotly}
    onUpdate={(data, layout, frames) => setState({ data, layout, frames })}
    useResizeHandler
    advancedTraceTypeSelector
/>`

type TabPreset = "all" | "lite"
type StoreMode = "api" | "csv"

@observer
export class EditorPlaygroundPage extends React.Component {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    storeMode: StoreMode = "api"
    configText = JSON.stringify(EXAMPLE_API_CONFIG, null, 2)
    csvText = EXAMPLE_CSV
    columnDefsText = JSON.stringify(EXAMPLE_CSV_COLUMN_DEFS, null, 2)
    loadError: string | undefined = undefined
    loadedConfig: GrapherInterface = EXAMPLE_API_CONFIG
    loadedStore: IndicatorStore = dataApiIndicatorStore({
        dataApiUrl: adminEditorEnvironment.dataApiUrl,
    })
    editorKey = 0
    withIndicatorCatalog = true
    tabPreset: TabPreset = "all"
    liveConfig: GrapherInterface | undefined = undefined
    savedConfig: GrapherInterface | undefined = undefined
    savedAt: Date | undefined = undefined
    isInputOpen = false
    isOutputOpen = false
    isCodeOpen = false

    constructor(props: Record<string, never>) {
        super(props)
        makeObservable(this, {
            storeMode: observable,
            configText: observable,
            csvText: observable,
            columnDefsText: observable,
            loadError: observable,
            loadedConfig: observable.ref,
            loadedStore: observable.ref,
            editorKey: observable,
            withIndicatorCatalog: observable,
            tabPreset: observable,
            liveConfig: observable.ref,
            savedConfig: observable.ref,
            savedAt: observable.ref,
            isInputOpen: observable,
            isOutputOpen: observable,
            isCodeOpen: observable,
        })
    }

    /** The exact props the playground is passing right now, as the code a
     *  host would write. Generated from state so it never drifts. */
    @computed get mountSnippet(): string {
        const storeLine =
            this.storeMode === "csv"
                ? `const store = csvIndicatorStore({\n    csv,          // the pasted CSV text\n    columnDefs,   // name, unit, description, source per column\n    name: "pasted CSV",\n})`
                : `const store = dataApiIndicatorStore({\n    dataApiUrl: "${adminEditorEnvironment.dataApiUrl}",\n    // catalog: what "Add indicator" offers; the admin passes its own\n})`
        const indicatorsLine = this.withIndicatorCatalog
            ? this.storeMode === "api"
                ? "    indicators={adminIndicatorCatalog(admin)} // OWID admin only"
                : "    // indicators: defaults to store.catalog (the CSV's columns)"
            : "    indicators={null}                          // no picker"
        const tabsLine =
            this.tabPreset === "lite"
                ? `    tabs={${JSON.stringify(LITE_TABS)}}`
                : "    // tabs: all that apply to the chart type"
        return `import { GrapherEditor, ${
            this.storeMode === "csv"
                ? "csvIndicatorStore"
                : "dataApiIndicatorStore"
        } } from "@ourworldindata/grapher-editor/react"

${storeLine}

const config = ${JSON.stringify(this.loadedConfig, null, 4)}

<GrapherEditor
    config={config}
    store={store}
${indicatorsLine}
${tabsLine}
    onChange={(config) => setLiveConfig(config)}  // every edit, in the store's form
    onSave={(config) => saveSomewhere(config)}     // "Save config" button
/>`
    }

    /** Builds the store for the current inputs. Throws on a bad CSV or defs. */
    private makeStore(): IndicatorStore {
        if (this.storeMode === "csv") {
            const columnDefs = JSON.parse(
                this.columnDefsText
            ) as OwidColumnDef[]
            return csvIndicatorStore({
                csv: this.csvText,
                columnDefs,
                name: "pasted CSV",
            })
        }
        return dataApiIndicatorStore({
            dataApiUrl: adminEditorEnvironment.dataApiUrl,
        })
    }

    @computed get indicators(): IndicatorCatalog | undefined {
        if (!this.withIndicatorCatalog) return undefined
        return this.storeMode === "api"
            ? adminIndicatorCatalog(this.context.admin)
            : this.loadedStore.catalog
    }

    @computed get details(): DetailsProvider {
        return adminDetailsProvider(this.context.admin)
    }

    @computed get tabs(): EditorTab[] | undefined {
        return this.tabPreset === "lite" ? LITE_TABS : undefined
    }

    @computed get liveConfigJson(): string {
        return JSON.stringify(this.liveConfig ?? this.loadedConfig, null, 2)
    }

    @action.bound loadConfig(): void {
        try {
            const parsed = JSON.parse(this.configText) as GrapherInterface
            const store = this.makeStore()
            this.loadError = undefined
            this.loadedConfig = parsed
            this.loadedStore = store
            this.liveConfig = undefined
            this.savedConfig = undefined
            this.savedAt = undefined
            this.editorKey++
            this.isInputOpen = false
        } catch (err) {
            this.loadError = err instanceof Error ? err.message : String(err)
        }
    }

    /** Re-mount the editor so a changed provider or tab set takes effect.
     *  The editor restarts from `loadedConfig`, so unsaved edits are gone and
     *  the live pane must not keep showing them. */
    @action.bound remount(): void {
        this.liveConfig = undefined
        this.editorKey++
    }

    @action.bound onChange(config: GrapherInterface): void {
        this.liveConfig = config
    }

    @action.bound onSave(config: GrapherInterface): void {
        this.savedConfig = config
        this.savedAt = new Date()
        this.isOutputOpen = true
        // What a host would do: the saved config is now the one to reopen,
        // so a later remount starts from it rather than the original.
        this.loadedConfig = config
    }

    @action.bound setIndicatorCatalog(enabled: boolean): void {
        this.withIndicatorCatalog = enabled
        this.remount()
    }

    @action.bound setTabPreset(preset: TabPreset): void {
        this.tabPreset = preset
        this.remount()
    }

    /** Switching stores loads that store's example, so there is always
     *  something to look at. */
    @action.bound setStoreMode(mode: StoreMode): void {
        this.storeMode = mode
        this.configText = JSON.stringify(
            mode === "csv" ? EXAMPLE_CSV_CONFIG : EXAMPLE_API_CONFIG,
            null,
            2
        )
        this.loadConfig()
    }

    override render(): React.ReactElement {
        const isCsv = this.storeMode === "csv"
        return (
            <AdminLayout noSidebar>
                <div className="EditorPlaygroundPage">
                    <div className="EditorPlaygroundPage__toolbar">
                        <Space size="middle" wrap>
                            <span>
                                Data store{" "}
                                <Segmented<StoreMode>
                                    size="small"
                                    value={this.storeMode}
                                    onChange={this.setStoreMode}
                                    options={[
                                        {
                                            label: "OWID Data API",
                                            value: "api",
                                        },
                                        { label: "Pasted CSV", value: "csv" },
                                    ]}
                                />
                            </span>
                            <Button
                                icon={<FontAwesomeIcon icon={faFileImport} />}
                                onClick={action(
                                    () => (this.isInputOpen = true)
                                )}
                            >
                                Load config
                            </Button>
                            <span>
                                Indicator picker{" "}
                                <Switch
                                    size="small"
                                    checked={this.withIndicatorCatalog}
                                    onChange={this.setIndicatorCatalog}
                                />
                            </span>
                            <span>
                                Tabs{" "}
                                <Segmented<TabPreset>
                                    size="small"
                                    value={this.tabPreset}
                                    onChange={this.setTabPreset}
                                    options={[
                                        { label: "All", value: "all" },
                                        { label: "Lite", value: "lite" },
                                    ]}
                                />
                            </span>
                            <Button
                                onClick={action(
                                    () => (this.isOutputOpen = true)
                                )}
                            >
                                Output config
                            </Button>
                            <Button
                                icon={<FontAwesomeIcon icon={faCode} />}
                                onClick={action(() => (this.isCodeOpen = true))}
                            >
                                Show code
                            </Button>
                            <span className="EditorPlaygroundPage__status">
                                {this.savedAt
                                    ? `Saved at ${this.savedAt.toLocaleTimeString()}`
                                    : "Not saved yet"}
                            </span>
                        </Space>
                    </div>

                    <GrapherEditor
                        key={this.editorKey}
                        config={this.loadedConfig}
                        store={this.loadedStore}
                        indicators={this.indicators ?? null}
                        details={this.details}
                        environment={adminEditorEnvironment}
                        tabs={this.tabs}
                        onChange={this.onChange}
                        onSave={this.onSave}
                    />

                    <Modal
                        title={
                            isCsv
                                ? "Load a grapher config and its CSV"
                                : "Load a grapher config"
                        }
                        open={this.isInputOpen}
                        onCancel={action(() => (this.isInputOpen = false))}
                        onOk={this.loadConfig}
                        okText="Load into editor"
                        width={720}
                    >
                        {isCsv ? (
                            <p>
                                The config references CSV columns by slug (
                                <code>ySlugs</code>, <code>xSlug</code>,{" "}
                                <code>colorSlug</code>, <code>sizeSlug</code>).
                                Column definitions carry the metadata the chart
                                shows: name, unit, description, source.
                            </p>
                        ) : (
                            <p>
                                Paste a chart config (JSON). Indicators are
                                loaded from the Data API, so any public variable
                                id works.
                            </p>
                        )}
                        <label className="EditorPlaygroundPage__label">
                            Config
                        </label>
                        <textarea
                            className="EditorPlaygroundPage__textarea"
                            value={this.configText}
                            onChange={action((e) => {
                                this.configText = e.target.value
                            })}
                        />
                        {isCsv && (
                            <>
                                <label className="EditorPlaygroundPage__label">
                                    CSV
                                </label>
                                <textarea
                                    className="EditorPlaygroundPage__textarea EditorPlaygroundPage__textarea--short"
                                    value={this.csvText}
                                    onChange={action((e) => {
                                        this.csvText = e.target.value
                                    })}
                                />
                                <label className="EditorPlaygroundPage__label">
                                    Column definitions
                                </label>
                                <textarea
                                    className="EditorPlaygroundPage__textarea EditorPlaygroundPage__textarea--short"
                                    value={this.columnDefsText}
                                    onChange={action((e) => {
                                        this.columnDefsText = e.target.value
                                    })}
                                />
                            </>
                        )}
                        {this.loadError && (
                            <div className="alert alert-danger mt-2">
                                {this.loadError}
                            </div>
                        )}
                    </Modal>

                    <Drawer
                        title="Output config"
                        open={this.isOutputOpen}
                        onClose={action(() => (this.isOutputOpen = false))}
                        size={560}
                    >
                        <h6>
                            Live config{" "}
                            <Button
                                size="small"
                                icon={<FontAwesomeIcon icon={faCopy} />}
                                onClick={() => {
                                    copyToClipboard(this.liveConfigJson).catch(
                                        () => undefined
                                    )
                                }}
                            >
                                Copy
                            </Button>
                        </h6>
                        <p className="text-muted">
                            What <code>onChange</code> receives: the config the
                            editor would hand back, in the store&rsquo;s own
                            form, updated as you edit.
                        </p>
                        <pre className="EditorPlaygroundPage__json">
                            {this.liveConfigJson}
                        </pre>
                        <h6>Last saved config</h6>
                        <p className="text-muted">
                            What <code>onSave</code> received when you last hit
                            &ldquo;Save config&rdquo;.
                        </p>
                        <pre className="EditorPlaygroundPage__json">
                            {this.savedConfig
                                ? JSON.stringify(this.savedConfig, null, 2)
                                : "—"}
                        </pre>
                    </Drawer>

                    <Drawer
                        title="How this editor is mounted"
                        open={this.isCodeOpen}
                        onClose={action(() => (this.isCodeOpen = false))}
                        size={640}
                    >
                        <Tabs
                            items={[
                                {
                                    key: "ours",
                                    label: "This editor",
                                    children: (
                                        <>
                                            <p className="text-muted">
                                                Generated from the current
                                                toolbar state. The component is
                                                real (
                                                <code>GrapherEditor.tsx</code>
                                                ); the import path is where it
                                                would live as a package.
                                            </p>
                                            <Button
                                                size="small"
                                                icon={
                                                    <FontAwesomeIcon
                                                        icon={faCopy}
                                                    />
                                                }
                                                onClick={() => {
                                                    copyToClipboard(
                                                        this.mountSnippet
                                                    ).catch(() => undefined)
                                                }}
                                            >
                                                Copy
                                            </Button>
                                            <pre className="EditorPlaygroundPage__json">
                                                {this.mountSnippet}
                                            </pre>
                                        </>
                                    ),
                                },
                                {
                                    key: "plotly",
                                    label: "Plotly react-chart-editor",
                                    children: (
                                        <>
                                            <p className="text-muted">
                                                The closest existing equivalent,
                                                from its readme. Same idea:
                                                config in, data as named
                                                columns, callback out.
                                            </p>
                                            <pre className="EditorPlaygroundPage__json">
                                                {PLOTLY_SNIPPET}
                                            </pre>
                                            <table className="table table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>Plotly</th>
                                                        <th>Here</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td>
                                                            <code>data</code> +{" "}
                                                            <code>layout</code>
                                                        </td>
                                                        <td>
                                                            <code>config</code>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>
                                                            <code>
                                                                dataSources
                                                            </code>{" "}
                                                            (column arrays)
                                                        </td>
                                                        <td>
                                                            <code>store</code>{" "}
                                                            (columns + name,
                                                            unit, source)
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>
                                                            <code>
                                                                dataSourceOptions
                                                            </code>
                                                        </td>
                                                        <td>
                                                            <code>
                                                                store.catalog
                                                            </code>{" "}
                                                            /{" "}
                                                            <code>
                                                                indicators
                                                            </code>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>
                                                            <code>
                                                                onUpdate
                                                            </code>
                                                        </td>
                                                        <td>
                                                            <code>
                                                                onChange
                                                            </code>{" "}
                                                            +{" "}
                                                            <code>onSave</code>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>
                                                            <code>plotly</code>{" "}
                                                            (the renderer)
                                                        </td>
                                                        <td>bundled grapher</td>
                                                    </tr>
                                                    <tr>
                                                        <td>
                                                            panel composition
                                                        </td>
                                                        <td>
                                                            <code>tabs</code>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </>
                                    ),
                                },
                            ]}
                        />
                    </Drawer>
                </div>
            </AdminLayout>
        )
    }
}
