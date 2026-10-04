import { useState, type ReactElement } from "react"
import { OwidGdocIndexItem } from "@ourworldindata/types"
import { getTagGraphRolesById } from "./TagGraphMetadata.js"
import { useUpdateGdocTags } from "./gdocsQueries.js"
import { useTags } from "./tagQueries.js"
import { GdocsIndexRow } from "./GdocsIndexRow.js"
import { GdocsChartPreviewsModal } from "./GdocsChartPreviewsModal.js"

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
    const [chartPreviewsGdoc, setChartPreviewsGdoc] =
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
                    onOpenChartPreviews={setChartPreviewsGdoc}
                    canEditTags={availableTags !== undefined}
                />
            ))}
            {chartPreviewsGdoc && (
                <GdocsChartPreviewsModal
                    gdocId={chartPreviewsGdoc.id}
                    gdocTitle={chartPreviewsGdoc.title || "Untitled"}
                    isOpen
                    onClose={() => setChartPreviewsGdoc(undefined)}
                />
            )}
        </>
    )
}
