import * as _ from "lodash-es"
import { Component } from "react"
import { observer } from "mobx-react"
import { Section } from "./Forms.js"
import { action, computed, observable, makeObservable } from "mobx"
import { copyToClipboard } from "@ourworldindata/utils"
import YAML from "yaml"
import { Modal, notification } from "antd"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued"
import { ConfigEditor } from "./ConfigEditor.js"
import { stringify } from "safe-stable-stringify"

@observer
export class EditorDebugTab extends Component<{
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

    /** The full config side by side with the base it sits on. */
    @computed get diffModal() {
        const { fullConfig, baseConfig } = this.props.editor
        return (
            <Modal
                open={this.diffModalOpen}
                centered
                width="80vw"
                onOk={this.onModalClose}
                onCancel={this.onModalClose}
                cancelButtonProps={{ style: { display: "none" } }}
            >
                <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
                    <ReactDiffViewer
                        newValue={stringify(fullConfig, null, 2)}
                        oldValue={stringify(baseConfig ?? {}, null, 2)}
                        leftTitle="Base config"
                        rightTitle="This chart"
                        compareMethod={DiffMethod.WORDS_WITH_SPACE}
                        styles={{
                            contentText: {
                                wordBreak: "break-word",
                            },
                        }}
                        extraLinesSurroundingDiff={2}
                        highlightLanguage="json"
                    />
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
        const { patchConfig, baseConfig, fullConfig } = this.props.editor

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
                    {baseConfig && (
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

                {baseConfig && (
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
                            value={YAML.stringify(baseConfig)}
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
