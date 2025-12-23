import type {
    OwidGdocContent,
    OwidGdocErrorMessage,
} from "@ourworldindata/types"
import type { OwidGdocPageProps } from "@ourworldindata/utils"
import type { Attachments } from "../shared/types.js"
import { OwidGdoc } from "@owid/site/gdocs/OwidGdoc.js"
import { DebugProvider } from "@owid/site/gdocs/DebugProvider.js"

interface PreviewProps {
    content: OwidGdocContent
    attachments: Attachments
    errors: OwidGdocErrorMessage[]
}

export function Preview({ content, attachments, errors }: PreviewProps) {
    // Build props for OwidGdoc component
    const gdocProps = {
        id: "preview",
        slug: "preview",
        content,
        published: false,
        createdAt: new Date(),
        publishedAt: null,
        updatedAt: new Date(),
        revisionId: null,
        markdown: null,
        breadcrumbs: null,
        manualBreadcrumbs: null,
        tags: attachments.tags,
        linkedAuthors: attachments.linkedAuthors,
        linkedCharts: attachments.linkedCharts,
        linkedIndicators: attachments.linkedIndicators,
        linkedDocuments: attachments.linkedDocuments,
        imageMetadata: attachments.imageMetadata,
        relatedCharts: attachments.relatedCharts,
        linkedNarrativeCharts: attachments.linkedNarrativeCharts,
        linkedStaticViz: attachments.linkedStaticViz,
        latestDataInsights: [],
        homepageMetadata: undefined,
        latestWorkLinks: [],
        donors: [],
    }

    return (
        <>
            {errors.length > 0 && (
                <div className="preview-errors">
                    <h4>Validation Errors</h4>
                    <ul>
                        {errors.map((error, index) => (
                            <li key={index} className={`error-${error.type}`}>
                                <strong>{error.property}:</strong>{" "}
                                {error.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {/* Match the structure from OwidGdocPage.tsx */}
            <div id="owid-document-root">
                <DebugProvider debug={true}>
                    <OwidGdoc
                        {...(gdocProps as OwidGdocPageProps)}
                        isPreviewing={true}
                    />
                </DebugProvider>
            </div>
        </>
    )
}
