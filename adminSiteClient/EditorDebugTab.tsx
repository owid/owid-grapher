import React from "react"
import { observer } from "mobx-react"
import { Section } from "./Forms.js"
import { ChartEditor, isChartEditorInstance } from "./ChartEditor.js"
import { action } from "mobx"
import { copyToClipboard } from "@ourworldindata/utils"
import YAML from "yaml"
import { notification } from "antd"
import {
    IndicatorChartEditor,
    isIndicatorChartEditorInstance,
} from "./IndicatorChartEditor.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"

@observer
export class EditorDebugTab<
    Editor extends AbstractChartEditor,
> extends React.Component<{
    editor: Editor
}> {
    render() {
        const { editor } = this.props
        if (isChartEditorInstance(editor))
            return <EditorDebugTabForChart editor={editor} />
        else if (isIndicatorChartEditorInstance(editor))
            return <EditorDebugTabForIndicatorChart editor={editor} />
        else return null
    }
}

@observer
class EditorDebugTabForChart extends React.Component<{
    editor: ChartEditor
}> {
    @action.bound copyYamlToClipboard() {
        // Avoid modifying the original JSON object
        // Due to mobx memoizing computed values, the JSON can be mutated.
        const patchConfig = {
            ...this.props.editor.patchConfig,
        }
        delete patchConfig.id
        delete patchConfig.dimensions
        delete patchConfig.version
        delete patchConfig.isPublished
        const chartConfigAsYaml = YAML.stringify(patchConfig)
        // Use the Clipboard API to copy the config into the users clipboard
        void copyToClipboard(chartConfigAsYaml)
        notification["success"]({
            message: "Copied YAML to clipboard",
            description: "You can now paste this into the ETL",
            placement: "bottomRight",
            closeIcon: <></>,
        })
    }

    render() {
        const {
            patchConfig,
            parentConfig,
            isInheritanceEnabled = false,
            fullConfig,
        } = this.props.editor

        return (
            <div>
                <Section name="Config">
                    <button
                        className="btn btn-primary"
                        onClick={this.copyYamlToClipboard}
                    >
                        Copy YAML for ETL
                    </button>
                    <textarea
                        rows={7}
                        readOnly
                        className="form-control"
                        value={JSON.stringify(patchConfig, undefined, 2)}
                    />
                </Section>

                {parentConfig && (
                    <Section
                        name={
                            isInheritanceEnabled
                                ? "Parent config (applied)"
                                : "Parent config (not currently applied)"
                        }
                    >
                        <textarea
                            rows={7}
                            readOnly
                            className="form-control"
                            value={JSON.stringify(parentConfig, undefined, 2)}
                        />
                    </Section>
                )}

                <Section name="Full Config">
                    <textarea
                        rows={7}
                        readOnly
                        className="form-control"
                        value={JSON.stringify(fullConfig, undefined, 2)}
                    />
                </Section>
            </div>
        )
    }
}

@observer
class EditorDebugTabForIndicatorChart extends React.Component<{
    editor: IndicatorChartEditor
}> {
    render() {
        const { patchConfig, parentConfig, fullConfig } = this.props.editor

        return (
            <div className="ConfigTab">
                <Section name="Config">
                    <textarea
                        rows={7}
                        readOnly
                        className="form-control"
                        value={JSON.stringify(patchConfig, undefined, 2)}
                    />
                </Section>
                {parentConfig && (
                    <>
                        <Section name="Parent config (authored in the ETL)">
                            <textarea
                                rows={7}
                                readOnly
                                className="form-control"
                                value={JSON.stringify(
                                    parentConfig,
                                    undefined,
                                    2
                                )}
                            />
                        </Section>
                        <Section name="Merged config">
                            <textarea
                                rows={7}
                                readOnly
                                className="form-control"
                                value={JSON.stringify(fullConfig, undefined, 2)}
                            />
                        </Section>
                    </>
                )}
            </div>
        )
    }
}
