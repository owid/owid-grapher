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

export const Default = () => {
    // const items = [
    //     <div key="element1">element1</div>,
    //     <div key="element2">element2</div>,
    //     <div key="element3">element3</div>,
    //     <div key="element4">element4</div>,
    //     <div key="element5">element5</div>,
    //     <div key="element6">element6</div>,
    //     <div key="element7">element7</div>,
    //     <div key="element8">element8</div>,
    //     <div key="element9">element9</div>,
    //     <div key="element10">element10</div>,
    //     <div key="element11">element11</div>,
    //     <div key="element12">element12</div>,
    //     <div key="element13">element13</div>,
    // ]
    const items: React.ReactElement[] = []
    for (let i = 0; i < 13; i++) {
        items.push(<SampleCheckBox key={i} id={i} />)
    }

    return <CollapsibleList items={items} />
}

export const MoreButtonComponent = () => {
    const options = [
        <div key="option1">option1</div>,
        <div key="option2">option2</div>,
        <div key="option3">option3</div>,
    ]

    return <MoreButton options={options} />
}
