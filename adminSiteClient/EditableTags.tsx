import React from "react"
import * as lodash from "lodash"
import { observable, action } from "mobx"
import { observer } from "mobx-react"
import { KeyChartLevel, Tag, TaggableType } from "@ourworldindata/utils"
import { TagBadge } from "./TagBadge.js"
import { EditTags } from "./EditTags.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faEdit, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons"

interface TaggableItem {
    id?: number
    type: TaggableType
}

@observer
export class EditableTags extends React.Component<{
    tags: Tag[]
    suggestions: Tag[]
    onSave: (tags: Tag[]) => void
    disabled?: boolean
    hasKeyChartSupport?: boolean
    hasSuggestionsSupport?: boolean
    taggable?: TaggableItem
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable isEditing: boolean = false
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @observable tags: Tag[] = lodash.clone(this.props.tags)

    @action.bound onAddTag(tag: Tag) {
        this.tags.push(tag)
        this.tags = lodash
            // we only want to keep one occurrence of the same tag, whether
            // entered manually or suggested through GPT. In case GPT suggests a
            // tag that is already in the list, we want to keep the first one to
            // preserve its status and key chart level
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
            this.props.onSave(
                this.tags
                    .filter(filterUncategorizedTag)
                    .map(setDefaultKeyChartLevel)
                    .map(setTagStatusToApprovedIfUnset)
            )
        }
        this.isEditing = !this.isEditing
    }

    @action.bound async onSuggest() {
        const { taggable } = this.props
        if (!taggable?.id) return

        const json: Record<"topics", Tag[]> = await this.context.admin.getJSON(
            `/api/gpt/suggest-topics/${taggable.type}/${taggable.id}.json`
        )

        if (!json?.topics?.length) return

        json.topics
            .map(setDefaultKeyChartLevel)
            .map(setTagStatusToPending)
            .forEach((tag) => {
                this.onAddTag(tag)
            })

        this.props.onSave(this.tags.filter(filterUncategorizedTag))
    }

    @action.bound onApprove(index: number) {
        this.tags[index].isApproved = true
        this.props.onSave(this.tags.filter(filterUncategorizedTag))
    }

    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        this.ensureUncategorized()
    }

    render() {
        const { disabled, hasKeyChartSupport, hasSuggestionsSupport } =
            this.props
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
                                onApprove={
                                    hasSuggestionsSupport &&
                                    filterUncategorizedTag(t)
                                        ? () => this.onApprove(i)
                                        : undefined
                                }
                                key={t.id}
                                tag={t}
                            />
                        ))}
                        {!disabled && (
                            <>
                                {hasSuggestionsSupport && (
                                    <button
                                        className="btn btn-link EditableTags__action"
                                        onClick={this.onSuggest}
                                    >
                                        <FontAwesomeIcon
                                            icon={faWandMagicSparkles}
                                        />
                                        Suggest
                                    </button>
                                )}
                                <button
                                    className="btn btn-link EditableTags__action"
                                    onClick={this.onToggleEdit}
                                >
                                    <FontAwesomeIcon icon={faEdit} />
                                    Edit
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        )
    }
}

const filterUncategorizedTag = (t: Tag) => t.name !== "Uncategorized"

const filterUnlistedTag = (t: Tag) => t.name !== "Unlisted"

const setDefaultKeyChartLevel = (t: Tag) => {
    if (t.keyChartLevel === undefined) t.keyChartLevel = KeyChartLevel.None
    return t
}

const setTagStatusToPending = (t: Tag) => {
    t.isApproved = false
    return t
}

const setTagStatusToApprovedIfUnset = (t: Tag) => {
    if (t.isApproved === undefined) t.isApproved = true
    return t
}
