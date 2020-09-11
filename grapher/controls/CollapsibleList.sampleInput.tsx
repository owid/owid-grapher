import React from "react"
import { observer } from "mobx-react"
import { observable, action } from "mobx"

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

const items: React.ReactElement[] = []
for (let i = 0; i < 13; i++) {
    items.push(<SampleCheckBox key={i} id={i} />)
}
export const collapsibleListSampleItems = items
