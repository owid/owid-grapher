import { useState, type ReactElement, type SubmitEvent } from "react"
import { Link } from "react-router-dom"
import { Button, Modal } from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { TagBadge } from "./TagBadge.js"
import { useAddTag, useTags } from "./tagQueries.js"

export function TagsIndexPage(): ReactElement {
    const { data: tags = [] } = useTags()
    const addTagMutation = useAddTag()
    const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false)

    function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const name = String(formData.get("name"))
        const slug = String(formData.get("slug"))
        addTagMutation.mutate(
            { name, slug: slug || null },
            {
                onSuccess: () => setIsAddTagModalOpen(false),
            }
        )
    }

    return (
        <AdminLayout title="Tags">
            <main className="TagsIndexPage">
                <Modal
                    className="TagsIndexPage__add-tag-modal"
                    title="Add tag"
                    open={isAddTagModalOpen}
                    onCancel={() => setIsAddTagModalOpen(false)}
                    okText="Add"
                    okButtonProps={{ htmlType: "submit" }}
                    confirmLoading={addTagMutation.isPending}
                    destroyOnHidden
                    modalRender={(modal) => (
                        <form onSubmit={handleSubmit}>{modal}</form>
                    )}
                >
                    <input name="name" placeholder="Name" required autoFocus />
                    <input name="slug" placeholder="Slug (optional)" />
                </Modal>
                <header className="TagsIndexPage__header">
                    <h2>Tags</h2>
                    <Button
                        type="primary"
                        onClick={() => setIsAddTagModalOpen(true)}
                    >
                        Add tag
                    </Button>
                </header>
                <p>
                    This is every single tag we have in the database. To
                    organise them hierarchically, see the{" "}
                    <Link to="tag-graph">tag graph</Link>.
                </p>
                {tags.map((tag) => (
                    <TagBadge
                        key={tag.id}
                        tag={tag}
                        tagGraphRole={tag.tagGraphRole}
                    />
                ))}
            </main>
        </AdminLayout>
    )
}
