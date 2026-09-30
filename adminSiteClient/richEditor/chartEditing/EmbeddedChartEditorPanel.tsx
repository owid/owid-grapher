import { observer } from "mobx-react"
import { Alert, Button, Space, Spin } from "antd"
import { AbstractChartEditor } from "../../AbstractChartEditor.js"
import { getFullReferencesCount } from "../../ChartEditor.js"
import { ChartEditorEnvironment } from "../../ChartEditorEnvironment.js"
import { ChartEditorSettingsPanel } from "../../ChartEditorSettingsPanel.js"
import { ChartEditingSession } from "./ChartEditingContext.js"
import { EmbeddedChartEditorHost } from "./EmbeddedChartEditorHosts.js"

/**
 * The right-rail "Chart editor" tab: the full chart editor form (its own
 * tabs as a second level) bound to the chart of the session's canvas block,
 * which renders the live preview in place.
 */
export const EmbeddedChartEditorPanel = observer(
    function EmbeddedChartEditorPanel(props: {
        session: ChartEditingSession
        environment: ChartEditorEnvironment<AbstractChartEditor> | null
        onClose: () => void
    }): React.ReactElement {
        const { session, environment } = props
        const { host } = session
        const editor = host.editor

        const isParentChart = session.kind === "chart"
        const fullEditorUrl = isParentChart
            ? `/admin/charts/${(host as EmbeddedChartEditorHost).chartId}/edit`
            : `/admin/narrative-charts/${
                  (host as Exclude<typeof host, EmbeddedChartEditorHost>)
                      .narrativeChartId
              }/edit`

        return (
            <div className="chart-editor-embedded">
                <div className="chart-editor-embedded__header">
                    <strong className="chart-editor-embedded__title">
                        {isParentChart
                            ? (editor?.grapherState.title ?? session.identity)
                            : session.identity}
                    </strong>
                    <Space size="small">
                        <a
                            href={fullEditorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open in full editor
                        </a>
                        <Button size="small" onClick={props.onClose}>
                            Close
                        </Button>
                    </Space>
                </div>
                {isParentChart && (
                    <Alert
                        type="warning"
                        showIcon
                        className="chart-editor-embedded__warning"
                        title="You are editing the chart itself"
                        description={`Saved changes appear on its grapher page and everywhere it is embedded${
                            editor?.references
                                ? ` (${getFullReferencesCount(editor.references)} references)`
                                : ""
                        }. To customize the chart only for this article, create a narrative chart instead.`}
                    />
                )}
                {session.kind === "narrative-chart" && (
                    <Alert
                        type="info"
                        showIcon
                        className="chart-editor-embedded__warning"
                        title="Narrative chart"
                        description="Changes only affect this narrative chart, not its parent."
                    />
                )}
                {editor && environment?.isReady ? (
                    <ChartEditorSettingsPanel
                        editor={editor}
                        environment={environment}
                    />
                ) : (
                    <div className="chart-editor-embedded__loading">
                        <Spin /> Loading editor…
                    </div>
                )}
            </div>
        )
    }
)
