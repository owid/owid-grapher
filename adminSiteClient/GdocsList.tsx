import { useState, type ReactElement } from "react"
import { OwidGdocIndexItem } from "@ourworldindata/types"
import { getTagGraphRolesById } from "./TagGraphMetadata.js"
import { useUpdateGdocTags } from "./gdocsQueries.js"
import { useTags } from "./tagQueries.js"
import { GdocsIndexRow } from "./GdocsIndexRow.js"
import { GdocsComponentPreviewsModal } from "./GdocsComponentPreviewsModal.js"

export function GdocsList({
    gdocs,
    basePath = "/gdocs",
}: {
    gdocs: OwidGdocIndexItem[]
    basePath?: string
}): ReactElement {
    const { data: availableTags } = useTags()
    const updateTagsMutation = useUpdateGdocTags()
    const tags = availableTags ?? []
    const orphanTagIds = new Set(
        tags.filter((tag) => tag.tagGraphRole === "orphan").map((tag) => tag.id)
    )
    const tagGraphRolesById = getTagGraphRolesById(tags)
    // One modal for the whole list rather than one per row
    const [componentPreviewsGdoc, setComponentPreviewsGdoc] =
        useState<OwidGdocIndexItem>()

    return (
        <>
            {gdocs.map((gdoc) => (
                <GdocsIndexRow
                    key={gdoc.id}
                    gdoc={gdoc}
                    basePath={basePath}
                    orphanTagIds={orphanTagIds}
                    availableTags={tags}
                    tagGraphRolesById={tagGraphRolesById}
                    onUpdateTags={async (gdocId, tags) => {
                        await updateTagsMutation.mutateAsync({ gdocId, tags })
                    }}
                    onOpenComponentPreviews={setComponentPreviewsGdoc}
                    canEditTags={availableTags !== undefined}
                />
            ))}
            {componentPreviewsGdoc && (
                <GdocsComponentPreviewsModal
                    gdocId={componentPreviewsGdoc.id}
                    gdocTitle={componentPreviewsGdoc.title || "Untitled"}
                    isOpen
                    onClose={() => setComponentPreviewsGdoc(undefined)}
                />
            )}
        </>
    )
}
