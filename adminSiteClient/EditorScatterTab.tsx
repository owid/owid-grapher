import * as _ from "lodash-es"
import { ScatterPointLabelStrategy } from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import { action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { NumberField, Section, SelectField, Toggle } from "./Forms.js"

@observer
export class EditorScatterTab extends Component<{
    grapherState: GrapherState
}> {
    constructor(props: { grapherState: GrapherState }) {
        super(props)
        makeObservable(this)
    }

    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.grapherState.hideTimeline = value || undefined
    }

    @action.bound onToggleHideScatterLabels(value: boolean) {
        this.props.grapherState.hideScatterLabels = value || undefined
    }

    @action.bound onXOverrideYear(value: number | undefined) {
        this.props.grapherState.xOverrideTime = value
    }

    @action.bound onToggleConnection(value: boolean) {
        const { grapherState } = this.props
        grapherState.hideConnectedScatterLines = value
    }

    @action.bound onChangeScatterPointLabelStrategy(value: string) {
        this.props.grapherState.scatterPointLabelStrategy =
            value as ScatterPointLabelStrategy
    }

    override render() {
        const { grapherState } = this.props

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
                        value={grapherState.xOverrideTime}
                        onValue={_.debounce(this.onXOverrideYear, 300)}
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
