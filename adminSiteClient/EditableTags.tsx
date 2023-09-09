import React from "react"
import * as lodash from "lodash"
import { observable, action } from "mobx"
import { observer } from "mobx-react"
import { KeyChartLevel } from "@ourworldindata/utils"
import { TagBadge, Tag } from "./TagBadge.js"
import { EditTags } from "./EditTags.js"

@observer
export class EditableTags extends React.Component<{
    tags: Tag[]
    suggestions: Tag[]
    onSave: (tags: Tag[]) => void
    disabled?: boolean
    hasKeyChartSupport?: boolean
}> {
    @observable isEditing: boolean = false
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @observable tags: Tag[] = lodash.clone(this.props.tags)

    @action.bound onAddTag(tag: Tag) {
        this.tags.push(tag)
        this.tags = lodash
            .uniqBy(this.tags, (t) => t.id)
            .filter(filterUncategorizedTag)

        this.ensureUncategorized()
    }

    @action.bound onRemoveTag(index: number) {
        this.tags.splice(index, 1)
        this.ensureUncategorized()
    }

    @action.bound onToggleKey(index: number) {
        const currentKeyChartLevel =
            this.tags[index].keyChartLevel || KeyChartLevel.None

        // We cycle through 4 states of key chart levels for a given topic / chart combination
        this.tags[index].keyChartLevel =
            currentKeyChartLevel === KeyChartLevel.None
                ? KeyChartLevel.Top
                : currentKeyChartLevel - 1

        this.props.onSave(this.tags.filter(filterUncategorizedTag))
    }

    @action.bound ensureUncategorized() {
        if (this.tags.length === 0) {
            const uncategorized = this.props.suggestions.find(
                (t) => t.name === "Uncategorized"
            )
            if (uncategorized) this.tags.push(uncategorized)
        }
    }

    @action.bound onToggleEdit() {
        if (this.isEditing) {
            // Add a default key chart level to new tags
            this.tags.forEach(
                (tag) =>
                    (tag.keyChartLevel =
                        tag.keyChartLevel ?? KeyChartLevel.None)
            )
            this.props.onSave(this.tags.filter(filterUncategorizedTag))
        }
        this.isEditing = !this.isEditing
    }

    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        this.ensureUncategorized()
    }

    render() {
        const { disabled, hasKeyChartSupport } = this.props
        const { tags } = this

        return (
            <div className="EditableTags">
                {this.isEditing ? (
                    <EditTags
                        tags={this.tags}
                        onAdd={this.onAddTag}
                        onDelete={this.onRemoveTag}
                        onSave={this.onToggleEdit}
                        suggestions={this.props.suggestions}
                    />
                ) : (
                    <div>
                        {tags.map((t, i) => (
                            <TagBadge
                                onToggleKey={
                                    hasKeyChartSupport &&
                                    filterUncategorizedTag(t) &&
                                    filterUnlistedTag(t)
                                        ? () => this.onToggleKey(i)
                                        : undefined
                                }
                                key={t.id}
                                tag={t}
                            />
                        ))}
                        {!disabled && (
                            <button
                                className="btn btn-link"
                                onClick={this.onToggleEdit}
                            >
                                Edit Tags
                            </button>
                        )}
                    </div>
                )}
            </div>
        )
    }
}

const filterUncategorizedTag = (t: Tag) => t.name !== "Uncategorized"

const filterUnlistedTag = (t: Tag) => t.name !== "Unlisted"
