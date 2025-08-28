import * as _ from "lodash-es"
import { ScatterPointLabelStrategy } from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import { action, computed, makeObservable, observable, reaction } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { NumberField, Section, SelectField, Toggle } from "./Forms.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"

@observer
export class EditorScatterTab<
    Editor extends AbstractChartEditor,
> extends Component<{
    editor: Editor
}> {
    xOverrideTimeInputValue: number | undefined = undefined
    disposers: (() => void)[] = []

    constructor(props: { editor: Editor }) {
        super(props)
        makeObservable(this, {
            xOverrideTimeInputValue: observable,
        })
    }

    @computed get grapherState(): GrapherState {
        return this.props.editor.grapherState
    }

    @action.bound onToggleHideTimeline(value: boolean) {
        this.grapherState.hideTimeline = value || undefined
    }

    @action.bound onToggleHideScatterLabels(value: boolean) {
        this.grapherState.hideScatterLabels = value || undefined
    }

    @action.bound async setXOverrideTime(xOverrideTime: number | undefined) {
        this.grapherState.xOverrideTime = xOverrideTime
        await this.props.editor.reloadGrapherData()
    }

    @action.bound onToggleConnection(value: boolean) {
        const { grapherState } = this
        grapherState.hideConnectedScatterLines = value
    }

    @action.bound onChangeScatterPointLabelStrategy(value: string) {
        this.grapherState.scatterPointLabelStrategy =
            value as ScatterPointLabelStrategy
    }

    override componentDidMount() {
        this.xOverrideTimeInputValue = this.grapherState.xOverrideTime
        const debouncedSetValue = _.debounce(this.setXOverrideTime, 300)
        this.disposers.push(() => debouncedSetValue.cancel())

        this.disposers.push(
            reaction(
                () => this.xOverrideTimeInputValue,
                (xOverrideTime) => debouncedSetValue(xOverrideTime)
            )
        )
    }

    override componentWillUnmount(): void {
        this.disposers.forEach((dispose) => dispose())
    }

    override render() {
        const { grapherState } = this

        return (
            <div className="EditorScatterTab">
                <Section name="Timeline">
                    <Toggle
                        label="Hide timeline"
                        value={!!grapherState.hideTimeline}
                        onValue={this.onToggleHideTimeline}
                    />
                    <Toggle
                        label="Hide connected scatter lines"
                        value={!!grapherState.hideConnectedScatterLines}
                        onValue={this.onToggleConnection}
                    />
                    <NumberField
                        label="Override X axis target year"
                        value={this.xOverrideTimeInputValue}
                        onValue={(val) => (this.xOverrideTimeInputValue = val)}
                        allowNegative
                    />
                </Section>
                <Section name="Point Labels">
                    <SelectField
                        value={grapherState.scatterPointLabelStrategy}
                        onValue={this.onChangeScatterPointLabelStrategy}
                        options={Object.keys(ScatterPointLabelStrategy).map(
                            (entry) => ({ value: entry })
                        )}
                    />
                    <Toggle
                        label="Hide point labels (except when hovering)"
                        value={!!grapherState.hideScatterLabels}
                        onValue={this.onToggleHideScatterLabels}
                    />
                </Section>
                <Section name="Filtering">
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
}
