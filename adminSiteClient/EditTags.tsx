import { createRef, Component } from "react"
import { action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { DbChartTagJoin, TagGraphRole } from "@ourworldindata/utils"
import {
    ReactTags,
    ReactTagsAPI,
    Tag as TagAutocomplete,
} from "react-tag-autocomplete"
import cx from "clsx"
import {
    getTagGraphRolesById,
    MinimalTagWithMetadata,
} from "./TagGraphMetadata.js"
import { TagGraphMarker } from "./TagGraphMarker.js"

interface EditTagsProps {
    tags: DbChartTagJoin[]
    suggestions: MinimalTagWithMetadata[]
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
        const suggestion = this.props.suggestions.find(
            ({ id }) => id === tag.value
        )
        if (suggestion) this.props.onAdd(suggestion)
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
        const tagGraphRolesById = getTagGraphRolesById(suggestions)
        return (
            <div className="EditTags" onClick={this.onClick}>
                <ReactTags
                    selected={tags.map(convertTagToAutocomplete)}
                    suggestions={suggestions.map(convertTagToAutocomplete)}
                    activateFirstOption
                    onAdd={this.onAdd}
                    onDelete={this.props.onDelete}
                    renderOption={({
                        children,
                        classNames,
                        option,
                        ...optionProps
                    }) => {
                        const tagGraphRole = getTagGraphRole(
                            option.value,
                            tagGraphRolesById
                        )
                        return (
                            <div
                                {...optionProps}
                                className={cx(classNames.option, {
                                    [classNames.optionIsActive]: option.active,
                                    "react-tags__listbox-option--area":
                                        tagGraphRole === "area",
                                    "react-tags__listbox-option--orphan":
                                        tagGraphRole === "orphan",
                                })}
                            >
                                {tagGraphRole !== "descendant" &&
                                    tagGraphRole && (
                                        <TagGraphMarker
                                            variant={tagGraphRole}
                                            className="react-tags__graph-marker"
                                        />
                                    )}
                                {children}
                            </div>
                        )
                    }}
                    renderTag={({ classNames, tag, ...tagProps }) => {
                        const tagGraphRole = getTagGraphRole(
                            tag.value,
                            tagGraphRolesById
                        )
                        return (
                            <button
                                {...tagProps}
                                type="button"
                                className={cx(classNames.tag, {
                                    "react-tags__tag--area":
                                        tagGraphRole === "area",
                                    "react-tags__tag--orphan":
                                        tagGraphRole === "orphan",
                                })}
                            >
                                <span className={classNames.tagName}>
                                    {tagGraphRole !== "descendant" &&
                                        tagGraphRole && (
                                            <TagGraphMarker
                                                variant={tagGraphRole}
                                                className="react-tags__graph-marker"
                                            />
                                        )}
                                    {tag.label}
                                </span>
                            </button>
                        )
                    }}
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

function getTagGraphRole(
    value: TagAutocomplete["value"],
    rolesById: ReturnType<typeof getTagGraphRolesById>
): TagGraphRole | undefined {
    return typeof value === "number" ? rolesById.get(value) : undefined
}
