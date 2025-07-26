import { createRef, Component } from "react"
import { action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { DbChartTagJoin } from "@ourworldindata/utils"
import {
    ReactTags,
    ReactTagsAPI,
    Tag as TagAutocomplete,
} from "react-tag-autocomplete"

interface EditTagsProps {
    tags: DbChartTagJoin[]
    suggestions: DbChartTagJoin[]
    onDelete: (index: number) => void
    onAdd: (tag: DbChartTagJoin) => void
    onSave: () => void
}

@observer
export class EditTags extends Component<EditTagsProps> {
    dismissable: boolean = true
    reactTagsApi = createRef<ReactTagsAPI>()

    constructor(props: EditTagsProps) {
        super(props)
        makeObservable(this)
    }

    @action.bound onClickSomewhere() {
        if (this.dismissable) this.props.onSave()
        this.dismissable = true
    }

    @action.bound onClick() {
        this.dismissable = false
    }

    @action.bound onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            this.props.onSave()
        }
    }

    onAdd = (tag: TagAutocomplete) => {
        this.props.onAdd(convertAutocompleteTotag(tag))
    }

    override componentDidMount() {
        document.addEventListener("click", this.onClickSomewhere)
        document.addEventListener("keydown", this.onKeyDown)
        this.reactTagsApi.current?.input?.focus()
    }

    override componentWillUnmount() {
        document.removeEventListener("click", this.onClickSomewhere)
        document.removeEventListener("keydown", this.onKeyDown)
    }

    override render() {
        const { tags, suggestions } = this.props
        return (
            <div className="EditTags" onClick={this.onClick}>
                <ReactTags
                    selected={tags.map(convertTagToAutocomplete)}
                    suggestions={suggestions.map(convertTagToAutocomplete)}
                    activateFirstOption
                    onAdd={this.onAdd}
                    onDelete={this.props.onDelete}
                    ref={this.reactTagsApi}
                />
            </div>
        )
    }
}

const convertTagToAutocomplete = (t: DbChartTagJoin) => ({
    value: t.id,
    label: t.name,
})
const convertAutocompleteTotag = (t: TagAutocomplete) => ({
    id: t.value as number,
    name: t.label,
})
