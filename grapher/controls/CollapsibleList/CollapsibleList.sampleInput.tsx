import React from "react"
import { observer } from "mobx-react"
import { observable, action, makeObservable } from "mobx"
import { range } from "../../../clientUtils/Util.js"

const SampleCheckBox = observer(
    class SampleCheckBox extends React.Component<{ id: number }> {
        checked: boolean = false

        constructor(props: { id: number }) {
            super(props)

            makeObservable(this, {
                checked: observable,
                onToggle: action.bound,
            })
        }

        onToggle(): void {
            this.checked = !this.checked
        }

        render(): JSX.Element {
            return (
                <label className="clickable">
                    <input
                        type="checkbox"
                        checked={this.checked}
                        onChange={this.onToggle}
                    />
                    {` checkbox ${this.props.id}`}
                </label>
            )
        }
    }
)

export const collapsibleListSampleItems = range(0, 12).map((i) => (
    <SampleCheckBox key={i} id={i} />
))
