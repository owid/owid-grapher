import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import {
    OwidGdocPublicationContext,
    type OwidGdoc as OwidGdocModel,
    type OwidGdocContent,
    type OwidGdocErrorMessage,
} from "@ourworldindata/types"
import {
    extractGdocPageData,
    type OwidGdocPageProps,
} from "@ourworldindata/utils"
import type { Attachments } from "../shared/types.js"
import { OwidGdoc } from "@owid/site/gdocs/OwidGdoc.js"
import { DebugProvider } from "@owid/site/gdocs/DebugProvider.js"
import { runDetailsOnDemandWithDetails } from "@owid/site/detailsOnDemand.js"
import { hydrateFootnotes } from "@owid/site/hydrateFootnotes.js"
import { getParsedDods } from "../shared/api.js"

interface PreviewProps {
    content: OwidGdocContent
    attachments: Attachments
    errors: OwidGdocErrorMessage[]
}

export function Preview({ content, attachments, errors }: PreviewProps) {
    const dodsQuery = useQuery({
        queryKey: ["parsedDods"],
        queryFn: getParsedDods,
        retry: false,
    })

    useEffect(() => {
        const container = document.querySelector("#owid-document-root")
        if (!container) return
        hydrateFootnotes({ container, hydrate: false })
    }, [content])

    useEffect(() => {
        if (!dodsQuery.data) return
        runDetailsOnDemandWithDetails(dodsQuery.data)
    }, [dodsQuery.data])

    useEffect(() => {
        if (!dodsQuery.error) return
        console.error("Error loading details on demand:", dodsQuery.error)
    }, [dodsQuery.error])

    // Build props for OwidGdoc component
    const gdoc = {
        id: "preview",
        slug: "preview",
        content,
        contentMd5: "preview",
        published: false,
        createdAt: new Date(),
        publishedAt: null,
        updatedAt: new Date(),
        revisionId: null,
        publicationContext: OwidGdocPublicationContext.unlisted,
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
        markdown: null,
    } as OwidGdocModel
    const gdocProps: OwidGdocPageProps = extractGdocPageData(gdoc)

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
                    <OwidGdoc {...gdocProps} isPreviewing={true} />
                </DebugProvider>
            </div>
        </>
    )
}
