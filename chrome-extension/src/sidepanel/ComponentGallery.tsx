import { useMemo } from "react"
import { DebugProvider } from "@owid/site/gdocs/DebugProvider.js"
import { AttachmentsContext } from "@owid/site/gdocs/AttachmentsContext.js"
import {
    galleryExamples,
    galleryAttachments,
    componentMetadata,
} from "./componentGalleryExamples.js"
import { ComponentCard } from "./ComponentCard.js"

interface ComponentGalleryProps {
    searchQuery: string
}

export function ComponentGallery({ searchQuery }: ComponentGalleryProps) {
    const filteredExamples = useMemo(() => {
        const query = searchQuery.toLowerCase().trim()
        if (!query) {
            return Object.entries(galleryExamples)
        }

        return Object.entries(galleryExamples).filter(([blockType]) => {
            // Search by component name
            if (blockType.toLowerCase().includes(query)) {
                return true
            }
            // Search by description
            const metadata = componentMetadata[blockType]
            if (metadata?.description.toLowerCase().includes(query)) {
                return true
            }
            return false
        })
    }, [searchQuery])

    // Convert galleryAttachments to the format expected by AttachmentsContext
    const attachmentsContextValue = useMemo(
        () => ({
            linkedAuthors: galleryAttachments.linkedAuthors,
            linkedCharts: galleryAttachments.linkedCharts,
            linkedIndicators: galleryAttachments.linkedIndicators,
            linkedDocuments: galleryAttachments.linkedDocuments,
            imageMetadata: galleryAttachments.imageMetadata,
            relatedCharts: galleryAttachments.relatedCharts,
            linkedNarrativeCharts: galleryAttachments.linkedNarrativeCharts,
            linkedStaticViz: galleryAttachments.linkedStaticViz,
            tags: galleryAttachments.tags,
            latestDataInsights: [],
            homepageMetadata: {},
            latestWorkLinks: [],
        }),
        []
    )

    return (
        <div className="component-gallery">
            <DebugProvider debug={true}>
                <AttachmentsContext.Provider value={attachmentsContextValue}>
                    {filteredExamples.length === 0 ? (
                        <div className="component-gallery__empty">
                            No components match "{searchQuery}"
                        </div>
                    ) : (
                        filteredExamples.map(([blockType, block]) => (
                            <ComponentCard
                                key={blockType}
                                blockType={blockType}
                                enrichedBlock={block}
                                metadata={componentMetadata[blockType]}
                            />
                        ))
                    )}
                </AttachmentsContext.Provider>
            </DebugProvider>
        </div>
    )
}
