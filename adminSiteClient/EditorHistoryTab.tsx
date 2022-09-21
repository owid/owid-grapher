import React from "react"
import { observer } from "mobx-react"
import { ChartEditor, Log } from "./ChartEditor.js"
import { Section, Timeago } from "./Forms.js"
import { computed, action, makeObservable } from "mobx"

const LogRenderer = observer(
    class LogRenderer extends React.Component<{
        log: Log
        applyConfig: (config: any) => void
    }> {
        constructor(props: { log: Log; applyConfig: (config: any) => void }) {
            super(props)

            makeObservable(this, {
                prettyConfig: computed,
                title: computed,
            })
        }

        get prettyConfig() {
            const { log } = this.props
            return JSON.stringify(JSON.parse(log.config), undefined, 2)
        }

        get title() {
            const { log } = this.props

            const user = log.userName || log.userId.toString()
            return (
                <>
                    Saved <Timeago time={log.createdAt} by={user} />
                </>
            )
        }

        render() {
            const { log } = this.props
            const { title } = this

            return (
                <li className="list-group-item d-flex justify-content-between">
                    <span>{title}</span>
                    <button
                        className="align-self-end btn btn-danger"
                        onClick={() => this.props.applyConfig(log.config)}
                    >
                        Restore
                    </button>
                </li>
            )
        }
    }
)

export const EditorHistoryTab = observer(
    class EditorHistoryTab extends React.Component<{ editor: ChartEditor }> {
        constructor(props: { editor: ChartEditor }) {
            super(props)

            makeObservable(this, {
                logs: computed,
                applyConfig: action.bound,
            })
        }

        get logs() {
            return this.props.editor.logs || []
        }

        async applyConfig(config: any) {
            const { grapher } = this.props.editor
            const configJson = JSON.parse(config)
            grapher.updateFromObject(configJson)
            grapher.updateAuthoredVersion({
                ...grapher.toObject(),
                data: configJson.data,
            })
            grapher.rebuildInputOwidTable()
        }

        render() {
            // Avoid modifying the original JSON object
            // Due to mobx memoizing computed values, the JSON can be mutated.
            const chartConfigObject = {
                ...this.props.editor.grapher.object,
            }
            return (
                <div>
                    {this.logs.map((log, i) => (
                        <ul key={i} className="list-group">
                            <LogRenderer
                                log={log}
                                applyConfig={this.applyConfig}
                            ></LogRenderer>
                        </ul>
                    ))}
                    <Section name="Debug Version">
                        <textarea
                            rows={7}
                            readOnly
                            className="form-control"
                            value={JSON.stringify(
                                chartConfigObject,
                                undefined,
                                2
                            )}
                        />
                    </Section>
                </div>
            )
        }
    }
)
