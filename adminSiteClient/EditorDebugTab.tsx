import * as _ from "lodash-es"
import { Component } from "react"
import { observer } from "mobx-react"
import { Section } from "./Forms.js"
import { action, computed, observable, makeObservable } from "mobx"
import { copyToClipboard } from "@ourworldindata/utils"
import YAML from "yaml"
import { Modal, notification } from "antd"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { ConfigEditor, isConfigEditorInstance } from "./ConfigEditor.js"
import { stringify } from "safe-stable-stringify"

@observer
export class EditorDebugTab<
    Editor extends AbstractChartEditor,
> extends Component<{
    editor: Editor
}> {
    override render() {
        const { editor } = this.props
        if (isConfigEditorInstance(editor))
            return <EditorDebugTabForConfig editor={editor} />
        else return null
    }
}

@observer
class EditorDebugTabForConfig extends Component<{
    editor: ConfigEditor
}> {
    constructor(props: { editor: ConfigEditor }) {
        super(props)
        makeObservable(this, { diffModalOpen: observable })
    }

    diffModalOpen = false

    @action.bound onModalClose() {
        this.diffModalOpen = false
    }

    /**
     * Every top-level field where this chart differs from its base, with both
     * values. A key-by-key table rather than a text diff of the two JSON
     * documents: it reads better for configs, and it keeps the syntax
     * highlighter a diff-viewer library would pull in out of the editor bundle.
     */
    @computed get diffModal() {
        const { fullConfig, parentConfig } = this.props.editor
        const base = (parentConfig ?? {}) as Record<string, unknown>
        const full = fullConfig as Record<string, unknown>
        const keys = _.sortBy(
            _.union(Object.keys(base), Object.keys(full)).filter(
                (key) => !_.isEqual(base[key], full[key])
            )
        )
        const show = (value: unknown): string =>
            value === undefined ? "" : stringify(value, null, 2)
        return (
            <Modal
                open={this.diffModalOpen}
                centered
                width="80vw"
                title="Differences to the base config"
                onOk={this.onModalClose}
                onCancel={this.onModalClose}
                cancelButtonProps={{ style: { display: "none" } }}
            >
                <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                    {keys.length === 0 ? (
                        <p>This chart is identical to its base config.</p>
                    ) : (
                        <table className="table table-sm">
                            <thead>
                                <tr>
                                    <th>Field</th>
                                    <th>Base config</th>
                                    <th>This chart</th>
                                </tr>
                            </thead>
                            <tbody>
                                {keys.map((key) => (
                                    <tr key={key}>
                                        <td>
                                            <code>{key}</code>
                                        </td>
                                        <td>
                                            <pre className="mb-0">
                                                {show(base[key])}
                                            </pre>
                                        </td>
                                        <td>
                                            <pre className="mb-0">
                                                {show(full[key])}
                                            </pre>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Modal>
        )
    }

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
            title: "Copied YAML to clipboard",
            description: "You can now paste this into the ETL",
            placement: "bottomRight",
            closeIcon: <></>,
        })
    }

    override render() {
        const { patchConfig, parentConfig, fullConfig } = this.props.editor

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
                    {parentConfig && (
                        <>
                            {this.diffModal}{" "}
                            <button
                                className="btn btn-secondary mt-2"
                                onClick={action(
                                    () => (this.diffModalOpen = true)
                                )}
                            >
                                Show diff to base config
                            </button>
                        </>
                    )}
                </Section>

                {parentConfig && (
                    <Section name="Base config">
                        <p>
                            The config above is a patch on top of this base;
                            fields the base supplies are shown as inherited in
                            the editor.
                        </p>
                        <textarea
                            rows={7}
                            readOnly
                            className="form-control"
                            value={YAML.stringify(parentConfig)}
                        />
                    </Section>
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
