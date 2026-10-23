import { GrapherState } from "@ourworldindata/grapher"
import * as lodash from "lodash-es"
import { action, computed, observable, reaction, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { NumberField, Section, Toggle } from "./Forms.js"
import { ConfigEditor } from "./ConfigEditor.js"

@observer
export class EditorMarimekkoTab extends Component<{
    editor: ConfigEditor
}> {
    xOverrideTimeInputField: number | undefined
    constructor(props: { editor: ConfigEditor }) {
        super(props)

        makeObservable(this, {
            xOverrideTimeInputField: observable,
        })
        this.xOverrideTimeInputField = props.editor.grapherState.xOverrideTime
    }

    @computed get grapherState(): GrapherState {
        return this.props.editor.grapherState
    }

    @action.bound onXOverrideYear(value: number | undefined) {
        this.xOverrideTimeInputField = value
    }

    @action.bound async setXOverrideTime(xOverrideTime: number | undefined) {
        this.grapherState.xOverrideTime = xOverrideTime
        await this.props.editor.reloadGrapherData()
    }

    override render() {
        const { grapherState } = this

        return (
            <div className="EditorMarimekkoTab">
                <Section name="Filtering">
                    {grapherState.canOverrideXTime && (
                        <NumberField
                            label="Override X axis target year"
                            value={this.xOverrideTimeInputField}
                            onValue={this.onXOverrideYear}
                            allowNegative
                        />
                    )}

                    <Toggle
                        label="Exclude entities that do not belong in any color group"
                        value={!!grapherState.matchingEntitiesOnly}
                        onValue={action(
                            (value: boolean) =>
                                (grapherState.matchingEntitiesOnly =
                                    value || undefined)
                        )}
                    />
                </Section>
            </div>
        )
    }
    disposers: (() => void)[] = []
    override componentDidMount() {
        const debouncedSetValue = lodash.debounce(this.setXOverrideTime, 800)
        // Apply a year entered just before the tab unmounts (e.g. on switching
        // tabs) instead of dropping it with the component
        this.disposers.push(() => {
            void debouncedSetValue.flush()
        })
        this.disposers.push(
            reaction(
                () => this.xOverrideTimeInputField,
                (xOverrideTime) => debouncedSetValue(xOverrideTime)
            )
        )
    }

    override componentWillUnmount() {
        this.disposers.forEach((dispose) => dispose())
    }
}
