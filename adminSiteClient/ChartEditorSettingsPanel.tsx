import * as _ from "lodash-es"
import * as React from "react"
import { observer } from "mobx-react"
import { getFullReferencesCount, isChartEditorInstance } from "./ChartEditor.js"
import { EditorBasicTab } from "./EditorBasicTab.js"
import { EditorDataTab } from "./EditorDataTab.js"
import { EditorTextTab } from "./EditorTextTab.js"
import { EditorCustomizeTab } from "./EditorCustomizeTab.js"
import { EditorScatterTab } from "./EditorScatterTab.js"
import { EditorMapTab } from "./EditorMapTab.js"
import { EditorHistoryTab } from "./EditorHistoryTab.js"
import { EditorReferencesTab } from "./EditorReferencesTab.js"
import { EditorDebugTab } from "./EditorDebugTab.js"
import { EditorMarimekkoTab } from "./EditorMarimekkoTab.js"
import { EditorExportTab } from "./EditorExportTab.js"
import { SaveButtons } from "./SaveButtons.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { ChartEditorEnvironment } from "./ChartEditorEnvironment.js"

interface ChartEditorSettingsPanelProps<Editor extends AbstractChartEditor> {
    editor: Editor
    environment: ChartEditorEnvironment<Editor>
}

/**
 * The chart editor form: the tab bar (basic/data/text/…), the active tab's
 * settings, and the save buttons. Shared by the standalone editor pages
 * (via ChartEditorView) and the rich editor's embedded chart editor panel.
 */
@observer
export class ChartEditorSettingsPanel<
    Editor extends AbstractChartEditor,
> extends React.Component<ChartEditorSettingsPanelProps<Editor>> {
    override render(): React.ReactElement {
        const { editor, environment } = this.props
        const { grapherState, availableTabs } = editor

        const chartEditor = isChartEditorInstance(editor) ? editor : undefined

        return (
            <>
                <div className="p-2">
                    <ul className="nav nav-tabs">
                        {availableTabs.map((tab) => (
                            <li key={tab} className="nav-item">
                                <a
                                    className={
                                        "nav-link" +
                                        (tab === editor.tab ? " active" : "")
                                    }
                                    onClick={() => {
                                        editor.tab = tab
                                        editor.showStaticPreview =
                                            tab === "export"
                                    }}
                                >
                                    {_.capitalize(tab)}
                                    {tab === "refs" && editor?.references
                                        ? ` (${getFullReferencesCount(
                                              editor.references
                                          )})`
                                        : ""}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="innerForm container">
                    {editor.tab === "basic" && (
                        <EditorBasicTab
                            editor={editor}
                            database={environment.database}
                            errorMessagesForDimensions={
                                environment.errorMessagesForDimensions
                            }
                        />
                    )}
                    {editor.tab === "text" && (
                        <EditorTextTab
                            editor={editor}
                            errorMessages={environment.errorMessages}
                        />
                    )}
                    {editor.tab === "data" && <EditorDataTab editor={editor} />}
                    {editor.tab === "customize" && (
                        <EditorCustomizeTab
                            editor={editor}
                            errorMessages={environment.errorMessages}
                        />
                    )}
                    {editor.tab === "scatter" && (
                        <EditorScatterTab editor={editor} />
                    )}
                    {editor.tab === "marimekko" && (
                        <EditorMarimekkoTab grapherState={grapherState} />
                    )}
                    {editor.tab === "map" && (
                        <EditorMapTab
                            editor={editor}
                            errorMessages={environment.errorMessages}
                        />
                    )}
                    {chartEditor && chartEditor.tab === "revisions" && (
                        <EditorHistoryTab editor={chartEditor} />
                    )}
                    {editor.tab === "refs" && (
                        <EditorReferencesTab editor={editor} />
                    )}
                    {editor.tab === "export" && (
                        <EditorExportTab editor={editor} />
                    )}
                    {editor.tab === "debug" && (
                        <EditorDebugTab editor={editor} />
                    )}
                </div>
                {editor.tab !== "export" && (
                    <SaveButtons
                        editor={editor}
                        errorMessages={environment.errorMessages}
                        errorMessagesForDimensions={
                            environment.errorMessagesForDimensions
                        }
                    />
                )}
            </>
        )
    }
}
