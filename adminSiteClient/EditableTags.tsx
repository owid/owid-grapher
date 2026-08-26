import { useState } from "react"
import * as _ from "lodash-es"
import {
    KeyChartLevel,
    TaggableType,
    DbChartTagJoin,
    TagGraphRole,
} from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEdit, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons"
import { TagBadge } from "./TagBadge.js"
import { EditTags } from "./EditTags.js"
import {
    getTagGraphRoleById,
    getTagGraphRolesById,
    MinimalTagWithMetadata,
} from "./TagGraphMetadata.js"
import { useSuggestTags } from "./tagQueries.js"

interface TaggableItem {
    id?: number
    type: TaggableType
}

type SaveTags = (tags: DbChartTagJoin[]) => void | Promise<void>

interface EditableTagsProps {
    tags: DbChartTagJoin[]
    suggestions: MinimalTagWithMetadata[]
    tagGraphRolesById?: ReadonlyMap<number, TagGraphRole>
    onSave: SaveTags
    disabled?: boolean
    hasKeyChartSupport?: boolean
    hasSuggestionsSupport?: boolean
    taggable?: TaggableItem
}

export function EditableTags(props: EditableTagsProps): React.ReactElement {
    const [initialEditorTags, setInitialEditorTags] = useState<
        DbChartTagJoin[] | null
    >(null)
    const [isSaving, setIsSaving] = useState(false)

    const tags = withUncategorizedFallback(
        sortTagsByName(props.tags),
        props.suggestions
    )
    const suggestTagsMutation = useSuggestTags()

    async function saveTags(nextTags: DbChartTagJoin[]): Promise<void> {
        if (isSaving) return

        setIsSaving(true)
        try {
            await props.onSave(removeUncategorized(nextTags))
            setInitialEditorTags(null)
            setIsSaving(false)
        } catch {
            // The Admin client displays request errors globally. Recovering from
            // them requires refreshing the page.
        }
    }

    function handleToggleKey(index: number): void {
        const nextTags = tags.map((tag, tagIndex) => {
            if (tagIndex !== index) return tag

            const currentKeyChartLevel = tag.keyChartLevel || KeyChartLevel.None
            return {
                ...tag,
                keyChartLevel:
                    currentKeyChartLevel === KeyChartLevel.None
                        ? KeyChartLevel.Top
                        : currentKeyChartLevel - 1,
            }
        })
        void saveTags(nextTags)
    }

    function handleSuggest(): void {
        const { taggable } = props
        if (!taggable?.id) return

        suggestTagsMutation.mutate(
            { type: taggable.type, id: taggable.id },
            {
                onSuccess: ({ topics }) => {
                    if (!topics.length) return

                    const nextTags = topics.reduce(
                        (currentTags, tag) =>
                            addTag(currentTags, {
                                ...setDefaultKeyChartLevel(tag),
                                isApproved: false,
                            }),
                        tags
                    )
                    void saveTags(nextTags)
                },
            }
        )
    }

    function handleApprove(index: number): void {
        const nextTags = tags.map((tag, tagIndex) =>
            tagIndex === index ? { ...tag, isApproved: true } : tag
        )
        void saveTags(nextTags)
    }

    if (initialEditorTags) {
        return (
            <TagsEditor
                initialTags={initialEditorTags}
                suggestions={props.suggestions}
                onSave={saveTags}
            />
        )
    }

    const { disabled, hasKeyChartSupport, hasSuggestionsSupport } = props
    const tagGraphRolesById =
        props.tagGraphRolesById ?? getTagGraphRolesById(props.suggestions)
    return (
        <div className="EditableTags">
            <div>
                {tags.map((tag, index) => (
                    <TagBadge
                        onToggleKey={
                            !isSaving &&
                            hasKeyChartSupport &&
                            !isUncategorizedTag(tag) &&
                            tag.name !== "Unlisted"
                                ? () => handleToggleKey(index)
                                : undefined
                        }
                        onApprove={
                            !isSaving &&
                            hasSuggestionsSupport &&
                            !isUncategorizedTag(tag)
                                ? () => handleApprove(index)
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
                                onClick={handleSuggest}
                                disabled={
                                    suggestTagsMutation.isPending || isSaving
                                }
                            >
                                <FontAwesomeIcon icon={faWandMagicSparkles} />
                                Suggest
                            </button>
                        )}
                        <button
                            className="btn btn-link EditableTags__action"
                            onClick={(event) => {
                                setInitialEditorTags(tags)
                                event.stopPropagation()
                            }}
                            disabled={isSaving}
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

function TagsEditor({
    initialTags,
    suggestions,
    onSave,
}: {
    initialTags: DbChartTagJoin[]
    suggestions: MinimalTagWithMetadata[]
    onSave: SaveTags
}): React.ReactElement {
    const [tags, setTags] = useState(() => removeUncategorized(initialTags))
    const displayedTags = withUncategorizedFallback(tags, suggestions)

    function handleSave(): void {
        void onSave(
            tags.map((tag) => ({
                ...setDefaultKeyChartLevel(tag),
                isApproved: tag.isApproved ?? true,
            }))
        )
    }

    return (
        <div className="EditableTags">
            <EditTags
                tags={displayedTags}
                onAdd={(tag) => setTags(addTag(tags, tag))}
                onDelete={(index) =>
                    setTags(
                        removeUncategorized(
                            displayedTags.filter(
                                (_, tagIndex) => tagIndex !== index
                            )
                        )
                    )
                }
                onSave={handleSave}
                suggestions={suggestions}
            />
        </div>
    )
}

function addTag(tags: DbChartTagJoin[], tag: DbChartTagJoin): DbChartTagJoin[] {
    // We only want to keep one occurrence of the same tag, whether entered
    // manually or suggested through GPT. If GPT suggests a tag already in the
    // list, keep the first one to preserve its status and key chart level.
    return sortTagsByName(
        removeUncategorized(_.uniqBy([...tags, tag], (tag) => tag.id))
    )
}

function withUncategorizedFallback(
    tags: DbChartTagJoin[],
    suggestions: MinimalTagWithMetadata[]
): DbChartTagJoin[] {
    if (tags.length > 0) return tags

    const uncategorized = suggestions.find(
        (tag) => tag.name === "Uncategorized"
    )
    return uncategorized ? [uncategorized] : tags
}

function removeUncategorized(tags: DbChartTagJoin[]): DbChartTagJoin[] {
    return tags.filter((tag) => !isUncategorizedTag(tag))
}

function sortTagsByName(tags: DbChartTagJoin[]): DbChartTagJoin[] {
    return _.sortBy(tags, (tag) => tag.name.toLowerCase())
}

const isUncategorizedTag = (tag: DbChartTagJoin): boolean =>
    tag.name === "Uncategorized"

function setDefaultKeyChartLevel(tag: DbChartTagJoin): DbChartTagJoin {
    return {
        ...tag,
        keyChartLevel: tag.keyChartLevel ?? KeyChartLevel.None,
    }
}
