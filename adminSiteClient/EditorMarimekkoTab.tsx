import { Grapher } from "@ourworldindata/grapher"
import lodash from "lodash"
import { action, IReactionDisposer, observable, reaction } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { NumberField, Section, Toggle } from "./Forms.js"

@observer
export class EditorMarimekkoTab extends Component<{ grapher: Grapher }> {
    @observable xOverrideTimeInputField: number | undefined
    constructor(props: { grapher: Grapher }) {
        super(props)
        this.xOverrideTimeInputField = props.grapher.xOverrideTime
    }

    @action.bound onXOverrideYear(value: number | undefined) {
        this.xOverrideTimeInputField = value
    }

    render() {
        const { grapher } = this.props

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
    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = reaction(
            () => this.xOverrideTimeInputField,
            lodash.debounce(
                () =>
                    (this.props.grapher.xOverrideTime =
                        this.xOverrideTimeInputField),
                800
            )
        )
    }

    componentWillUnmount() {
        this.dispose()
    }
}
