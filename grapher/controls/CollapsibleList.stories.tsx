import * as React from "react"
import { CollapsibleList, MoreButton } from "./CollapsibleList"
import { observer } from "mobx-react"
import { observable, action } from "mobx"

export default {
    title: "CollapsibleList",
    component: CollapsibleList,
}

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
export const collapsibleListInputItems: React.ReactElement[] = items

export const CollapsibleListComponent = () => {
    return <CollapsibleList items={collapsibleListInputItems} />
}

export const MoreButtonComponent = () => {
    const options = [
        <div key="option1">option1</div>,
        <div key="option2">option2</div>,
        <div key="option3">option3</div>,
    ]

    return <MoreButton options={options} />
}
