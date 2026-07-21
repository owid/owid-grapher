import * as React from "react"
import * as lodash from "lodash-es"
import { observable, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    KeyChartLevel,
    TaggableType,
    DbChartTagJoin,
    TagGraphRole,
} from "@ourworldindata/utils"
import { TagBadge } from "./TagBadge.js"
import { EditTags } from "./EditTags.js"
import {
    getTagGraphRoleById,
    getTagGraphRolesById,
    MinimalTagWithMetadata,
} from "./TagGraphMetadata.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEdit, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons"

interface TaggableItem {
    id?: number
    type: TaggableType
}

interface EditableTagsProps {
    tags: DbChartTagJoin[]
    suggestions: MinimalTagWithMetadata[]
    tagGraphRolesById?: ReadonlyMap<number, TagGraphRole>
    onSave: (tags: DbChartTagJoin[]) => void
    disabled?: boolean
    hasKeyChartSupport?: boolean
    hasSuggestionsSupport?: boolean
    taggable?: TaggableItem
}

@observer
export class EditableTags extends React.Component<EditableTagsProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    isEditing: boolean = false
    base = React.createRef<HTMLDivElement>()

    tags: DbChartTagJoin[] = lodash.clone(this.props.tags)

    constructor(props: EditableTagsProps) {
        super(props)

        makeObservable(this, {
            isEditing: observable,
            tags: observable,
        })
    }

    @action.bound onAddTag(tag: DbChartTagJoin) {
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

        const json: Record<"topics", DbChartTagJoin[]> =
            await this.context.admin.getJSON(
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

    override componentDidMount() {
        this.componentDidUpdate()
    }

    override componentDidUpdate() {
        this.ensureUncategorized()
    }

    override render() {
        if (this.isEditing) {
            return (
                <div className="EditableTags">
                    <EditTags
                        tags={this.tags}
                        onAdd={this.onAddTag}
                        onDelete={this.onRemoveTag}
                        onSave={this.onToggleEdit}
                        suggestions={this.props.suggestions}
                    />
                </div>
            )
        }

        const { disabled, hasKeyChartSupport, hasSuggestionsSupport } =
            this.props
        const tagGraphRolesById =
            this.props.tagGraphRolesById ??
            getTagGraphRolesById(this.props.suggestions)
        return (
            <div className="EditableTags">
                <div>
                    {this.tags.map((tag, index) => (
                        <TagBadge
                            onToggleKey={
                                hasKeyChartSupport &&
                                filterUncategorizedTag(tag) &&
                                filterUnlistedTag(tag)
                                    ? () => this.onToggleKey(index)
                                    : undefined
                            }
                            onApprove={
                                hasSuggestionsSupport &&
                                filterUncategorizedTag(tag)
                                    ? () => this.onApprove(index)
                                    : undefined
                            }
                            key={tag.id}
                            tag={tag}
                            tagGraphRole={getTagGraphRoleById(
                                tagGraphRolesById,
                                tag.id
                            )}
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
                                onClick={(event) => {
                                    this.onToggleEdit()
                                    event.stopPropagation()
                                }}
                            >
                                <FontAwesomeIcon icon={faEdit} />
                                Edit tags
                            </button>
                        </>
                    )}
                </div>
            </div>
        )
    }
}

const filterUncategorizedTag = (t: DbChartTagJoin) => t.name !== "Uncategorized"

const filterUnlistedTag = (t: DbChartTagJoin) => t.name !== "Unlisted"

const setDefaultKeyChartLevel = (t: DbChartTagJoin) => {
    if (t.keyChartLevel === undefined) t.keyChartLevel = KeyChartLevel.None
    return t
}

const setTagStatusToPending = (t: DbChartTagJoin) => {
    t.isApproved = false
    return t
}

const setTagStatusToApprovedIfUnset = (t: DbChartTagJoin) => {
    if (t.isApproved === undefined) t.isApproved = true
    return t
}
