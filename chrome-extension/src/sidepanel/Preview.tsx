import { useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import type {
    OwidGdocContent,
    OwidGdocErrorMessage,
} from "@ourworldindata/types"
import {
    parseIntOrUndefined,
    type OwidGdocPageProps,
} from "@ourworldindata/utils"
import type { Attachments } from "../shared/types.js"
import { OwidGdoc } from "@owid/site/gdocs/OwidGdoc.js"
import { DebugProvider } from "@owid/site/gdocs/DebugProvider.js"
import { Footnote } from "@owid/site/Footnote.js"
import { runDetailsOnDemandWithDetails } from "@owid/site/detailsOnDemand.js"
import { getParsedDods } from "../shared/api.js"

interface PreviewProps {
    content: OwidGdocContent
    attachments: Attachments
    errors: OwidGdocErrorMessage[]
}

interface FootnoteContent {
    index: number
    href: string
    htmlContent: string
}

const getFootnoteContent = (element: Element): FootnoteContent | null => {
    const href = element.closest("a.ref")?.getAttribute("href")
    if (!href) return null

    const index = parseIntOrUndefined(href.split("-")[1])
    if (index === undefined) return null

    const referencedEl = document.querySelector(href)
    if (!referencedEl?.innerHTML) return null
    return { index, href, htmlContent: referencedEl.innerHTML }
}

const runFootnotes = (container: ParentNode): void => {
    const footnotes = container.querySelectorAll("a.ref")

    footnotes.forEach((footnote) => {
        if (!(footnote instanceof HTMLElement)) return
        if (footnote.dataset.owidFootnote === "true") return

        const footnoteContent = getFootnoteContent(footnote)
        if (!footnoteContent) return

        footnote.dataset.owidFootnote = "true"
        createRoot(footnote).render(
            <Footnote
                index={footnoteContent.index}
                htmlContent={footnoteContent.htmlContent}
                triggerTarget={footnote}
            />
        )
    })
}

export function Preview({ content, attachments, errors }: PreviewProps) {
    const dodsLoadedRef = useRef(false)

    useEffect(() => {
        const container = document.querySelector("#owid-document-root")
        if (!container) return
        runFootnotes(container)
    }, [content])

    useEffect(() => {
        if (dodsLoadedRef.current) return
        dodsLoadedRef.current = true
        const loadDods = async (): Promise<void> => {
            try {
                const details = await getParsedDods()
                runDetailsOnDemandWithDetails(details)
            } catch (error) {
                console.error("Error loading details on demand:", error)
            }
        }
        void loadDods()
    }, [])

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
