import * as React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    runInAction,
    autorun,
    action,
    reaction,
    IReactionDisposer
} from "mobx"
import { Prompt, Redirect } from "react-router-dom"

import { ChartView } from "charts/chart/ChartView"
import { Bounds } from "charts/utils/Bounds"
import { includes, capitalize } from "charts/utils/Util"
import { Grapher } from "charts/core/Grapher"

import {
    ChartEditor,
    EditorDatabase,
    Log,
    PostReference,
    ChartRedirect
} from "./ChartEditor"
import { EditorBasicTab } from "./EditorBasicTab"
import { EditorDataTab } from "./EditorDataTab"
import { EditorTextTab } from "./EditorTextTab"
import { EditorCustomizeTab } from "./EditorCustomizeTab"
import { EditorScatterTab } from "./EditorScatterTab"
import { EditorMapTab } from "./EditorMapTab"
import { EditorHistoryTab } from "./EditorHistoryTab"
import { EditorReferencesTab } from "./EditorReferencesTab"
import { SaveButtons } from "./SaveButtons"
import { LoadingBlocker } from "./Forms"
import { AdminLayout } from "./AdminLayout"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faMobile } from "@fortawesome/free-solid-svg-icons/faMobile"
import { faDesktop } from "@fortawesome/free-solid-svg-icons/faDesktop"
import {
    VisionDeficiency,
    VisionDeficiencySvgFilters,
    VisionDeficiencyDropdown,
    VisionDeficiencyEntity
} from "./VisionDeficiencies"

@observer
class TabBinder extends React.Component<{ editor: ChartEditor }> {
    dispose!: IReactionDisposer
    componentDidMount() {
        //window.addEventListener("hashchange", this.onHashChange)
        this.onHashChange()

        this.dispose = autorun(() => {
            //setTimeout(() => window.location.hash = `#${tab}-tab`, 100)
        })
    }

    componentWillUnmount() {
        //window.removeEventListener("hashchange", this.onHashChange)
        this.dispose()
    }

    render() {
        return null
    }

    @action.bound onHashChange() {
        const match = window.location.hash.match(/#(.+?)-tab/)
        if (match) {
            const tab = match[1]
            if (
                this.props.editor.chart &&
                includes(this.props.editor.availableTabs, tab)
            )
                this.props.editor.tab = tab
        }
    }
}

@observer
export class ChartEditorPage extends React.Component<{
    chartId?: number
    newChartIndex?: number
    chartConfig?: any
}> {
    @observable.ref chart?: Grapher
    @observable.ref database?: EditorDatabase
    @observable logs?: Log[]
    @observable references?: PostReference[]
    @observable redirects?: ChartRedirect[]
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable simulateVisionDeficiency?: VisionDeficiency

    async fetchChart() {
        const { chartId, chartConfig } = this.props
        const { admin } = this.context
        const json =
            chartId === undefined
                ? chartConfig
                : await admin.getJSON(`/api/charts/${chartId}.config.json`)
        runInAction(() => (this.chart = new Grapher(json)))
    }

    async fetchData() {
        const { admin } = this.context
        const json = await admin.getJSON(`/api/editorData/namespaces.json`)
        runInAction(() => (this.database = new EditorDatabase(json)))
    }

    async fetchLogs() {
        const { chartId } = this.props
        const { admin } = this.context
        const json =
            chartId === undefined
                ? []
                : await admin.getJSON(`/api/charts/${chartId}.logs.json`)
        runInAction(() => (this.logs = json.logs))
    }

    async fetchRefs() {
        const { chartId } = this.props
        const { admin } = this.context
        const json =
            chartId === undefined
                ? []
                : await admin.getJSON(`/api/charts/${chartId}.references.json`)
        runInAction(() => (this.references = json.references))
    }

    async fetchRedirects() {
        const { chartId } = this.props
        const { admin } = this.context
        const json =
            chartId === undefined
                ? []
                : await admin.getJSON(`/api/charts/${chartId}.redirects.json`)
        runInAction(() => (this.redirects = json.redirects))
    }

    @computed get editor(): ChartEditor | undefined {
        if (this.chart === undefined || this.database === undefined) {
            return undefined
        } else {
            const that = this
            return new ChartEditor({
                get admin() {
                    return that.context.admin
                },
                get chart() {
                    return that.chart as Grapher
                },
                get database() {
                    return that.database as EditorDatabase
                },
                get logs() {
                    return that.logs as Log[]
                },
                get references() {
                    return that.references as PostReference[]
                },
                // Hack: Allow overriding redirects so that we can update it
                // from the inner "add redirect" form
                redirects: that.redirects || []
            })
        }
    }

    @action.bound refresh() {
        this.fetchChart()
        this.fetchData()
        this.fetchLogs()
        this.fetchRefs()
        this.fetchRedirects()
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.refresh()

        this.dispose = reaction(
            () => this.editor && this.editor.previewMode,
            () => {
                if (this.editor) {
                    localStorage.setItem(
                        "editorPreviewMode",
                        this.editor.previewMode
                    )
                }
            }
        )
    }

    // This funny construction allows the "new chart" link to work by forcing an update
    // even if the props don't change
    componentWillReceiveProps() {
        setTimeout(() => this.refresh(), 0)
    }

    componentWillUnmount() {
        this.dispose()
    }

    render() {
        return (
            <AdminLayout noSidebar>
                <main className="ChartEditorPage">
                    {(this.editor === undefined ||
                        this.editor.currentRequest) && <LoadingBlocker />}
                    {this.editor !== undefined && this.renderReady(this.editor)}
                </main>
            </AdminLayout>
        )
    }

    renderReady(editor: ChartEditor) {
        const { chart, availableTabs, previewMode } = editor

        return (
            <React.Fragment>
                {!editor.newChartId && (
                    <Prompt
                        when={editor.isModified}
                        message="Are you sure you want to leave? Unsaved changes will be lost."
                    />
                )}
                {editor.newChartId && (
                    <Redirect to={`/charts/${editor.newChartId}/edit`} />
                )}
                <TabBinder editor={editor} />
                <div className="chart-editor-settings">
                    <div className="p-2">
                        <ul className="nav nav-tabs">
                            {availableTabs.map(tab => (
                                <li key={tab} className="nav-item">
                                    <a
                                        className={
                                            "nav-link" +
                                            (tab === editor.tab
                                                ? " active"
                                                : "")
                                        }
                                        onClick={() => (editor.tab = tab)}
                                    >
                                        {capitalize(tab)}
                                        {tab === "refs" && this.references
                                            ? ` (${this.references.length})`
                                            : ""}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="innerForm container">
                        {editor.tab === "basic" && (
                            <EditorBasicTab editor={editor} />
                        )}
                        {editor.tab === "text" && (
                            <EditorTextTab editor={editor} />
                        )}
                        {editor.tab === "data" && (
                            <EditorDataTab editor={editor} />
                        )}
                        {editor.tab === "customize" && (
                            <EditorCustomizeTab editor={editor} />
                        )}
                        {editor.tab === "scatter" && (
                            <EditorScatterTab chart={chart} />
                        )}
                        {editor.tab === "map" && (
                            <EditorMapTab editor={editor} />
                        )}
                        {editor.tab === "revisions" && (
                            <EditorHistoryTab editor={editor} />
                        )}
                        {editor.tab === "refs" && (
                            <EditorReferencesTab editor={editor} />
                        )}
                    </div>
                    <SaveButtons editor={editor} />
                </div>
                <div className="chart-editor-view">
                    <figure
                        data-grapher-src
                        style={{
                            filter:
                                this.simulateVisionDeficiency &&
                                `url(#${this.simulateVisionDeficiency.id})`
                        }}
                    >
                        {
                            <ChartView
                                chart={chart}
                                bounds={
                                    previewMode === "mobile"
                                        ? new Bounds(0, 0, 360, 500)
                                        : new Bounds(0, 0, 800, 600)
                                }
                            />
                        }
                    </figure>
                    <div>
                        <div
                            className="btn-group"
                            data-toggle="buttons"
                            style={{ whiteSpace: "nowrap" }}
                        >
                            <label
                                className={
                                    "btn btn-light" +
                                    (previewMode === "mobile" ? " active" : "")
                                }
                                title="Mobile preview"
                            >
                                <input
                                    type="radio"
                                    onChange={action(
                                        () => (editor.previewMode = "mobile")
                                    )}
                                    name="previewSize"
                                    id="mobile"
                                    checked={previewMode === "mobile"}
                                />{" "}
                                <FontAwesomeIcon icon={faMobile} />
                            </label>
                            <label
                                className={
                                    "btn btn-light" +
                                    (previewMode === "desktop" ? " active" : "")
                                }
                                title="Desktop preview"
                            >
                                <input
                                    onChange={action(
                                        () => (editor.previewMode = "desktop")
                                    )}
                                    type="radio"
                                    name="previewSize"
                                    id="desktop"
                                    checked={previewMode === "desktop"}
                                />{" "}
                                <FontAwesomeIcon icon={faDesktop} />
                            </label>
                        </div>
                        <div
                            className="form-group d-inline-block"
                            style={{ width: 250, marginLeft: 15 }}
                        >
                            Emulate vision deficiency:{" "}
                            <VisionDeficiencyDropdown
                                onChange={action(
                                    (option: VisionDeficiencyEntity) =>
                                        (this.simulateVisionDeficiency =
                                            option.deficiency)
                                )}
                            />
                        </div>
                    </div>

                    {/* Include svg filters necessary for vision deficiency emulation */}
                    <VisionDeficiencySvgFilters />
                </div>
            </React.Fragment>
        )
    }
}
