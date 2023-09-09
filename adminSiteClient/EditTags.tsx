import React from "react"
import { action } from "mobx"
import { observer } from "mobx-react"
import { Tag } from "./TagBadge.js"
import ReactTags from "react-tag-autocomplete"

@observer
export class EditTags extends React.Component<{
    tags: Tag[]
    suggestions: Tag[]
    onDelete: (index: number) => void
    onAdd: (tag: Tag) => void
    onSave: () => void
}> {
    dismissable: boolean = true

    @action.bound onClickSomewhere() {
        if (this.dismissable) this.props.onSave()
        this.dismissable = true
    }

    @action.bound onClick() {
        this.dismissable = false
    }

    componentDidMount() {
        document.addEventListener("click", this.onClickSomewhere)
    }

    componentWillUnmount() {
        document.removeEventListener("click", this.onClickSomewhere)
    }

    render() {
        const { tags, suggestions } = this.props
        return (
            <div className="EditTags" onClick={this.onClick}>
                <ReactTags
                    tags={tags}
                    suggestions={suggestions}
                    onAddition={this.props.onAdd}
                    onDelete={this.props.onDelete}
                    minQueryLength={1}
                />
            </div>
        )
    }
}
