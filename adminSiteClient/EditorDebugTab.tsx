import React from "react"
import { observer } from "mobx-react"
import { Section, Toggle } from "./Forms.js"
import { ChartEditor, isChartEditorInstance } from "./ChartEditor.js"
import { action } from "mobx"
import { copyToClipboard, mergeGrapherConfigs } from "@ourworldindata/utils"
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

    @action.bound onToggleInheritance(shouldBeEnabled: boolean) {
        const { patchConfig, parentConfig } = this.props.editor

        // update live grapher
        const newParentConfig = shouldBeEnabled ? parentConfig : undefined
        const newConfig = mergeGrapherConfigs(
            newParentConfig ?? {},
            patchConfig
        )
        this.props.editor.updateLiveGrapher(newConfig)

        this.props.editor.isInheritanceEnabled = shouldBeEnabled
    }

    render() {
        const {
            patchConfig,
            parentConfig,
            isInheritanceEnabled,
            fullConfig,
            parentVariableId,
            grapher,
        } = this.props.editor

        const column = parentVariableId
            ? grapher.inputTable.get(parentVariableId.toString())
            : undefined

        const variableLink = (
            <a
                href={`/admin/variables/${parentVariableId}`}
                target="_blank"
                rel="noopener"
            >
                {column?.name ?? parentVariableId}
            </a>
        )

        return (
            <div>
                <Section name="Config">
                    <textarea
                        rows={7}
                        readOnly
                        className="form-control"
                        value={YAML.stringify(patchConfig)}
                    />
                    <button
                        className="btn btn-primary mt-2"
                        onClick={this.copyYamlToClipboard}
                    >
                        Copy YAML for ETL
                    </button>
                </Section>

                {parentVariableId && (
                    <>
                        <Section name="Parent indicator">
                            {isInheritanceEnabled ? (
                                <p>
                                    This chart is configured to inherit settings
                                    from its parent indicator, {variableLink}.
                                    {!parentConfig && (
                                        <>
                                            {" "}
                                            But the parent indicator does not
                                            yet have an associated Grapher
                                            config. You can{" "}
                                            <a
                                                href={`/admin/variables/${parentVariableId}/config`}
                                                target="_blank"
                                                rel="noopener"
                                            >
                                                create one in the admin.
                                            </a>
                                        </>
                                    )}
                                </p>
                            ) : (
                                <p>
                                    This chart may inherit chart settings from
                                    the indicator {variableLink}, but
                                    inheritance is currently disabled. Toggle
                                    the option below to enable inheritance.
                                </p>
                            )}
                            <Toggle
                                label="Enable inheritance"
                                value={!!isInheritanceEnabled}
                                onValue={this.onToggleInheritance}
                            />
                        </Section>
                        {parentConfig && (
                            <Section
                                name={
                                    isInheritanceEnabled
                                        ? "Parent config"
                                        : "Parent config (not currently applied)"
                                }
                            >
                                <textarea
                                    rows={7}
                                    readOnly
                                    className="form-control"
                                    value={YAML.stringify(parentConfig)}
                                />
                                <p className="mt-2">
                                    <a
                                        href={`/admin/variables/${parentVariableId}/config`}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        Edit parent config in the admin
                                    </a>
                                </p>
                            </Section>
                        )}
                    </>
                )}

                <Section name="Full Config">
                    <textarea
                        rows={7}
                        readOnly
                        className="form-control"
                        value={YAML.stringify(fullConfig)}
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
                        value={YAML.stringify(patchConfig)}
                    />
                </Section>
                {parentConfig && (
                    <>
                        <Section name="Parent config (authored in the ETL)">
                            <textarea
                                rows={7}
                                readOnly
                                className="form-control"
                                value={YAML.stringify(parentConfig)}
                            />
                        </Section>
                        <Section name="Merged config">
                            <textarea
                                rows={7}
                                readOnly
                                className="form-control"
                                value={YAML.stringify(fullConfig)}
                            />
                        </Section>
                    </>
                )}
            </div>
        )
    }
}