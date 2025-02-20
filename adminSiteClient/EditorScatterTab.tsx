import {
    ComparisonLineConfig,
    ScatterPointLabelStrategy,
} from "@ourworldindata/types"
import { Grapher } from "@ourworldindata/grapher"
import { debounce } from "@ourworldindata/utils"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { NumberField, Section, SelectField, Toggle } from "./Forms.js"

@observer
export class EditorScatterTab extends Component<{ grapher: Grapher }> {
    @observable comparisonLine: ComparisonLineConfig = { yEquals: undefined }

    constructor(props: { grapher: Grapher }) {
        super(props)
    }

    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.grapher.hideTimeline = value || undefined
    }

    @action.bound onToggleHideScatterLabels(value: boolean) {
        this.props.grapher.hideScatterLabels = value || undefined
    }

    @action.bound onXOverrideYear(value: number | undefined) {
        this.props.grapher.xOverrideTime = value
    }

    @action.bound onToggleConnection(value: boolean) {
        const { grapher } = this.props
        grapher.hideConnectedScatterLines = value
    }

    @action.bound onChangeScatterPointLabelStrategy(value: string) {
        this.props.grapher.scatterPointLabelStrategy =
            value as ScatterPointLabelStrategy
    }

    render() {
        const { grapher } = this.props

        return (
            <div className="EditorScatterTab">
                <Section name="Timeline">
                    <Toggle
                        label="Hide timeline"
                        value={!!grapher.hideTimeline}
                        onValue={this.onToggleHideTimeline}
                    />
                    <Toggle
                        label="Hide connected scatter lines"
                        value={!!grapher.hideConnectedScatterLines}
                        onValue={this.onToggleConnection}
                    />
                    <NumberField
                        label="Override X axis target year"
                        value={grapher.xOverrideTime}
                        onValue={debounce(this.onXOverrideYear, 300)}
                        allowNegative
                    />
                </Section>
                <Section name="Point Labels">
                    <SelectField
                        value={grapher.scatterPointLabelStrategy}
                        onValue={this.onChangeScatterPointLabelStrategy}
                        options={Object.keys(ScatterPointLabelStrategy).map(
                            (entry) => ({ value: entry })
                        )}
                    />
                    <Toggle
                        label="Hide point labels (except when hovering)"
                        value={!!grapher.hideScatterLabels}
                        onValue={this.onToggleHideScatterLabels}
                    />
                </Section>
                <Section name="Filtering">
                    <Toggle
                        label="Exclude entities that do not belong in any color group"
                        value={!!grapher.matchingEntitiesOnly}
                        onValue={action(
                            (value: boolean) =>
                                (grapher.matchingEntitiesOnly =
                                    value || undefined)
                        )}
                    />
                </Section>
            </div>
        )
    }
}
