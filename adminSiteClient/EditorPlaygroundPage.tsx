/**
 * A page for trying the config-only chart editor: paste a grapher config,
 * edit it against the live preview, and read the edited config back. It is
 * the in-repo stand-in for what a consumer of the future editor package would
 * build, so it deliberately touches nothing chart-specific in the admin.
 */
import * as React from "react"
import { observer } from "mobx-react"
import { action, computed, observable, makeObservable } from "mobx"
import { Button, Drawer, Modal, Segmented, Space, Switch } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCopy, faFileImport } from "@fortawesome/free-solid-svg-icons"
import { DimensionProperty, GrapherInterface } from "@ourworldindata/types"
import { copyToClipboard } from "@ourworldindata/utils"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import { ConfigEditor, ConfigEditorManager } from "./ConfigEditor.js"
import { EditorTab } from "./AbstractChartEditor.js"
import {
    adminDetailsProvider,
    adminIndicatorCatalog,
    DetailsProvider,
    IndicatorCatalog,
} from "./editorProviders.js"

import "./EditorPlaygroundPage.scss"

// Life expectancy at birth, served by the public Data API, so the preview
// works against any database.
const EXAMPLE_CONFIG: GrapherInterface = {
    title: "Life expectancy",
    subtitle:
        "The period life expectancy at birth, in a given year. Try editing this.",
    hasMapTab: true,
    selectedEntityNames: ["World", "Africa", "Europe", "Asia"],
    dimensions: [{ property: DimensionProperty.y, variableId: 1118466 }],
}

const LITE_TABS: EditorTab[] = ["basic", "data", "text", "customize", "map"]

type TabPreset = "all" | "lite"

interface ConfigEditorHostProps {
    config: GrapherInterface
    indicators?: IndicatorCatalog
    details?: DetailsProvider
    tabs?: EditorTab[]
    onSave: (config: GrapherInterface) => void | Promise<void>
    onChange?: (config: GrapherInterface) => void
}

/**
 * The glue between props and the editor's two manager interfaces. A package
 * consumer's `GrapherEditor.mount(...)` would be this component.
 */
@observer
class ConfigEditorHost
    extends React.Component<ConfigEditorHostProps>
    implements ConfigEditorManager, ChartEditorViewManager<ConfigEditor>
{
    constructor(props: ConfigEditorHostProps) {
        super(props)
        makeObservable(this)
    }

    isInheritanceEnabled = false

    get patchConfig(): GrapherInterface {
        return this.props.config
    }

    get indicators(): IndicatorCatalog | undefined {
        return this.props.indicators
    }

    get details(): DetailsProvider | undefined {
        return this.props.details
    }

    get tabs(): EditorTab[] | undefined {
        return this.props.tabs
    }

    get onSave(): (config: GrapherInterface) => void | Promise<void> {
        return this.props.onSave
    }

    get onChange(): ((config: GrapherInterface) => void) | undefined {
        return this.props.onChange
    }

    @computed get editor(): ConfigEditor {
        return new ConfigEditor({ manager: this })
    }

    override render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}

@observer
export class EditorPlaygroundPage extends React.Component {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    configText = JSON.stringify(EXAMPLE_CONFIG, null, 2)
    configError: string | undefined = undefined
    loadedConfig: GrapherInterface = EXAMPLE_CONFIG
    editorKey = 0
    withIndicatorCatalog = true
    tabPreset: TabPreset = "all"
    liveConfig: GrapherInterface | undefined = undefined
    savedConfig: GrapherInterface | undefined = undefined
    savedAt: Date | undefined = undefined
    isInputOpen = false
    isOutputOpen = false

    constructor(props: Record<string, never>) {
        super(props)
        makeObservable(this, {
            configText: observable,
            configError: observable,
            loadedConfig: observable.ref,
            editorKey: observable,
            withIndicatorCatalog: observable,
            tabPreset: observable,
            liveConfig: observable.ref,
            savedConfig: observable.ref,
            savedAt: observable.ref,
            isInputOpen: observable,
            isOutputOpen: observable,
        })
    }

    @computed get indicators(): IndicatorCatalog | undefined {
        return this.withIndicatorCatalog
            ? adminIndicatorCatalog(this.context.admin)
            : undefined
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
            this.configError = undefined
            this.loadedConfig = parsed
            this.liveConfig = undefined
            this.savedConfig = undefined
            this.savedAt = undefined
            this.editorKey++
            this.isInputOpen = false
        } catch (err) {
            this.configError = err instanceof Error ? err.message : String(err)
        }
    }

    /** Re-mount the editor so a changed provider or tab set takes effect. */
    @action.bound remount(): void {
        this.editorKey++
    }

    @action.bound onChange(config: GrapherInterface): void {
        this.liveConfig = config
    }

    @action.bound onSave(config: GrapherInterface): void {
        this.savedConfig = config
        this.savedAt = new Date()
        this.isOutputOpen = true
    }

    @action.bound setIndicatorCatalog(enabled: boolean): void {
        this.withIndicatorCatalog = enabled
        this.remount()
    }

    @action.bound setTabPreset(preset: TabPreset): void {
        this.tabPreset = preset
        this.remount()
    }

    override render(): React.ReactElement {
        return (
            <AdminLayout noSidebar>
                <div className="EditorPlaygroundPage">
                    <div className="EditorPlaygroundPage__toolbar">
                        <Space size="middle" wrap>
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
                            <span className="EditorPlaygroundPage__status">
                                {this.savedAt
                                    ? `Saved at ${this.savedAt.toLocaleTimeString()}`
                                    : "Not saved yet"}
                            </span>
                        </Space>
                    </div>

                    <ConfigEditorHost
                        key={this.editorKey}
                        config={this.loadedConfig}
                        indicators={this.indicators}
                        details={this.details}
                        tabs={this.tabs}
                        onChange={this.onChange}
                        onSave={this.onSave}
                    />

                    <Modal
                        title="Load a grapher config"
                        open={this.isInputOpen}
                        onCancel={action(() => (this.isInputOpen = false))}
                        onOk={this.loadConfig}
                        okText="Load into editor"
                        width={720}
                    >
                        <p>
                            Paste a chart config (JSON). Indicators are loaded
                            from the Data API, so any public variable id works.
                        </p>
                        <textarea
                            className="EditorPlaygroundPage__textarea"
                            value={this.configText}
                            onChange={action((e) => {
                                this.configText = e.target.value
                            })}
                        />
                        {this.configError && (
                            <div className="alert alert-danger mt-2">
                                {this.configError}
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
                            What <code>onChange</code> receives: the patch the
                            editor would hand back, updated as you edit.
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
                </div>
            </AdminLayout>
        )
    }
}
