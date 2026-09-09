import { useContext, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Prompt, Redirect } from "react-router-dom"
import { AutoComplete } from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { Timeago, Toggle } from "./Forms.js"
import { DatasetList } from "./DatasetList.js"
import { ChartList } from "./ChartList.js"
import { TagBadge } from "./TagBadge.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { GdocsList } from "./GdocsList.js"
import { usePublishedGdocTopicSlugs } from "./gdocsQueries.js"
import {
    tagKeys,
    TagDetailResponse,
    TagPageData,
    useTag,
} from "./tagQueries.js"

interface TagEditable {
    name: string
    slug: string | null
    searchableInAlgolia: boolean
}

function extractEditableTag(tag: TagPageData): TagEditable {
    return {
        name: tag.name,
        slug: tag.slug,
        searchableInAlgolia: tag.searchableInAlgolia,
    }
}

function isTagModified(editableTag: TagEditable, tag: TagPageData): boolean {
    return (
        editableTag.name !== tag.name ||
        editableTag.slug !== tag.slug ||
        editableTag.searchableInAlgolia !== tag.searchableInAlgolia
    )
}

export function TagEditPage({ tagId }: { tagId: number }): React.ReactElement {
    const { data: tagData } = useTag(tagId)
    const { data: publishedGdocTopicSlugs } = usePublishedGdocTopicSlugs()
    const tag = tagData?.tag

    return (
        <AdminLayout title={tag?.name}>
            {/* Reset the form when navigating to another tag while preserving
                unsaved edits when this tag's query cache is updated. */}
            {tag?.id === tagId && publishedGdocTopicSlugs && (
                <TagEditor
                    key={tag.id}
                    tag={tag}
                    publishedGdocTopicSlugs={publishedGdocTopicSlugs}
                />
            )}
        </AdminLayout>
    )
}

function TagEditor({
    tag,
    publishedGdocTopicSlugs,
}: {
    tag: TagPageData
    publishedGdocTopicSlugs: string[]
}): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()
    const tagId = tag.id
    const [editableTag, setEditableTag] = useState<TagEditable>(() =>
        extractEditableTag(tag)
    )
    const [isDeleted, setIsDeleted] = useState(false)

    const saveMutation = useMutation({
        mutationFn: (nextTag: TagEditable) =>
            admin.requestJSON<
                TagDetailResponse & { tagUpdateWarning?: string }
            >(`/api/tags/${tagId}`, { tag: nextTag }, "PUT"),
        onSuccess: async (result) => {
            queryClient.setQueryData<TagDetailResponse>(tagKeys.detail(tagId), {
                tag: result.tag,
            })
            await queryClient.invalidateQueries({
                queryKey: tagKeys.list(),
            })
            if (result.tagUpdateWarning) {
                window.alert(result.tagUpdateWarning)
            }
        },
    })

    const deleteMutation = useMutation({
        mutationFn: () =>
            admin.requestJSON<{ success: boolean }>(
                `/api/tags/${tagId}/delete`,
                {},
                "DELETE"
            ),
        onSuccess: async ({ success }) => {
            if (!success) return

            await queryClient.invalidateQueries({
                queryKey: tagKeys.list(),
            })
            setEditableTag(extractEditableTag(tag))
            setIsDeleted(true)
        },
    })

    const isModified = isTagModified(editableTag, tag)
    const slugMatchesPublishedTopicPage =
        !!editableTag.slug && publishedGdocTopicSlugs.includes(editableTag.slug)

    const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>): void => {
        event.preventDefault()
        saveMutation.mutate(editableTag)
    }

    const handleDelete = (): void => {
        if (
            window.confirm(
                `Really delete the tag ${tag.name}? This action cannot be undone!`
            )
        ) {
            deleteMutation.mutate()
        }
    }

    return (
        <main className="TagEditPage">
            <Prompt
                when={isModified && !isDeleted}
                message="Are you sure you want to leave? Unsaved changes will be lost."
            />
            {isDeleted && <Redirect to="/tags" />}
            <section>
                <h1>Tag: {tag.name}</h1>
                <p>
                    Last updated <Timeago time={tag.updatedAt} />
                </p>
            </section>
            <section>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="tag-name">Name</label>
                        <input
                            id="tag-name"
                            className="form-control"
                            value={editableTag.name}
                            onChange={(event) =>
                                setEditableTag((current) => ({
                                    ...current,
                                    name: event.target.value,
                                }))
                            }
                        />
                        <small className="form-text text-muted">
                            Tag names must be unique and should be able to be
                            understood without context
                        </small>
                    </div>
                    <div className="form-group">
                        <label>Slug</label>
                        <AutoComplete
                            style={{ width: "100%" }}
                            value={editableTag.slug ?? ""}
                            onChange={(value) =>
                                setEditableTag((current) => ({
                                    ...current,
                                    slug: value || null,
                                }))
                            }
                            options={publishedGdocTopicSlugs.map((slug) => ({
                                value: slug,
                                label: slug,
                            }))}
                            showSearch={{
                                filterOption: (inputValue, option) =>
                                    !!option?.label &&
                                    option.label
                                        .toLowerCase()
                                        .startsWith(inputValue.toLowerCase()),
                            }}
                            allowClear
                        />
                        <small className="form-text text-muted">
                            The slug for this tag's topic page, e.g.
                            trade-and-globalization.
                        </small>
                    </div>
                    <Toggle
                        label="Searchable in Algolia (must exist in tag graph)"
                        value={
                            editableTag.searchableInAlgolia ||
                            slugMatchesPublishedTopicPage
                        }
                        onValue={(searchableInAlgolia) =>
                            setEditableTag((current) => ({
                                ...current,
                                searchableInAlgolia,
                            }))
                        }
                        disabled={slugMatchesPublishedTopicPage}
                        secondaryLabel={
                            slugMatchesPublishedTopicPage
                                ? "This slug matches a published topic page, so charts with this tag will be indexed in Algolia"
                                : "When enabled, charts with this tag will be indexed in Algolia even without matching a published topic page"
                        }
                    />
                    <div style={{ marginTop: 16 }}>
                        <input
                            type="submit"
                            disabled={
                                !isModified ||
                                !editableTag.name ||
                                saveMutation.isPending
                            }
                            className="btn btn-success"
                            value="Update tag"
                        />{" "}
                        {tag.datasets.length === 0 &&
                            tag.children.length === 0 &&
                            !tag.specialType && (
                                <button
                                    className="btn btn-danger"
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={deleteMutation.isPending}
                                >
                                    Delete tag
                                </button>
                            )}
                    </div>
                </form>
            </section>
            {tag.children.length > 0 && (
                <section>
                    <h3>Subcategories</h3>
                    {tag.children.map((child) => (
                        <TagBadge
                            tag={child}
                            key={child.id}
                            tagGraphRole={child.tagGraphRole}
                        />
                    ))}
                </section>
            )}
            {tag.datasets.length > 0 && (
                <section>
                    <h3>Datasets</h3>
                    <DatasetList datasets={tag.datasets} />
                </section>
            )}
            {tag.charts.length > 0 && (
                <section>
                    <h3>Charts</h3>
                    <ChartList charts={tag.charts} />
                </section>
            )}
            {tag.gdocs.length > 0 && (
                <section>
                    <h3>Google Docs</h3>
                    <GdocsList gdocs={tag.gdocs} />
                </section>
            )}
        </main>
    )
}
