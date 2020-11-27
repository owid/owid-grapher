import React from "react"
import { observer } from "mobx-react"
import { observable, action } from "mobx"
import { range } from "clientUtils/Util"

@observer
class SampleCheckBox extends React.Component<{ id: number }> {
    @observable checked: boolean = false

    @action.bound onToggle() {
        this.checked = !this.checked
    }

    render() {
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

export const collapsibleListSampleItems = range(0, 12).map((i) => (
    <SampleCheckBox key={i} id={i} />
))
