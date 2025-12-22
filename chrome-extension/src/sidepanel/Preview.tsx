import React from "react"
import type { OwidGdocContent, OwidGdocErrorMessage } from "@ourworldindata/types"
import type { Attachments } from "../shared/types.js"
import { OwidGdoc } from "@owid/site/gdocs/OwidGdoc.js"

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
        <div className="preview-container">
            {errors.length > 0 && (
                <div className="preview-errors">
                    <h4>Validation Errors</h4>
                    <ul>
                        {errors.map((error, index) => (
                            <li key={index} className={`error-${error.type}`}>
                                <strong>{error.property}:</strong> {error.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="preview-content">
                <OwidGdoc {...gdocProps} isPreviewing={true} />
            </div>
        </div>
    )
}
