import { GrapherState } from "@ourworldindata/grapher"
import * as lodash from "lodash-es"
import { action, IReactionDisposer, observable, reaction } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { NumberField, Section, Toggle } from "./Forms.js"

@observer
export class EditorMarimekkoTab extends Component<{
    grapherState: GrapherState
}> {
    @observable xOverrideTimeInputField: number | undefined
    constructor(props: { grapherState: GrapherState }) {
        super(props)
        this.xOverrideTimeInputField = props.grapherState.xOverrideTime
    }

    @action.bound onXOverrideYear(value: number | undefined) {
        this.xOverrideTimeInputField = value
    }

    render() {
        const { grapherState } = this.props

        return (
            <div className="EditorMarimekkoTab">
                <Section name="Filtering">
                    <NumberField
                        label="Override X axis target year"
                        value={this.xOverrideTimeInputField}
                        onValue={this.onXOverrideYear}
                        allowNegative
                    />

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
    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = reaction(
            () => this.xOverrideTimeInputField,
            lodash.debounce(
                () =>
                    (this.props.grapherState.xOverrideTime =
                        this.xOverrideTimeInputField),
                800
            )
        )
    }

    componentWillUnmount() {
        this.dispose()
    }
}
