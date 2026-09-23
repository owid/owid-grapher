import { useContext } from "react"
import { Alert, Button, Select, Space, Typography } from "antd"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
    OwidEnrichedGdocBlock,
    OwidGdocErrorMessageType,
} from "@ourworldindata/types"
import { deserializeOwidGdocPageData } from "@ourworldindata/utils"
import {
    RichEditorPreviewRequest,
    RichEditorPreviewResponse,
} from "../../../adminShared/RichEditorTypes.js"
import { AdminAppContext } from "../../AdminAppContext.js"
import { OwidGdoc } from "../../../site/gdocs/OwidGdoc.js"
import { DebugProvider } from "../../../site/gdocs/DebugProvider.js"
import { AriaAnnouncerProvider } from "../../../site/AriaAnnouncerContext.js"
import { AriaAnnouncer } from "../../../site/AriaAnnouncer.js"

import "./siteStyles.scss"
import "./GdocPreview.scss"

export interface GdocPreviewProps {
    gdocId: string
    /** The body as the editor has it right now */
    body: OwidEnrichedGdocBlock[]
    /** Bumped by the parent to re-snapshot the body and refetch attachments */
    version: number
    /** Profiles: the entity to show; undefined picks the first in scope */
    entity?: string
    onEntityChange: (entity: string) => void
}

/**
 * The document as the site would publish it, rendered in place through the
 * site's own page component. The server resolves the attachments (linked
 * charts, images, authors, …) for the current body, exactly as it does when
 * baking; the site stylesheet is scoped to this container. Lazy-loaded by
 * the editor page, so the site CSS and components only load on first use.
 */
export default function GdocPreview(
    props: GdocPreviewProps
): React.ReactElement {
    const { gdocId, body, version, entity, onEntityChange } = props
    const { admin } = useContext(AdminAppContext)

    const previewQuery = useQuery<RichEditorPreviewResponse>({
        queryKey: ["richEditorPreview", gdocId, version, entity ?? null],
        queryFn: () => {
            const request: RichEditorPreviewRequest = { body, entity }
            return admin.requestJSON<RichEditorPreviewResponse>(
                `/api/gdocs/${gdocId}/editorPreview`,
                request,
                "POST"
            )
        },
        staleTime: Infinity,
        retry: false,
        // keep showing the previous render while a refreshed snapshot loads,
        // so the page keeps its height (and scroll position)
        placeholderData: keepPreviousData,
    })

    if (previewQuery.isError) {
        return (
            <Alert
                type="error"
                showIcon
                title="Could not render the preview"
                description={String(previewQuery.error ?? "")}
                action={
                    <Button
                        size="small"
                        onClick={() => {
                            void previewQuery.refetch()
                        }}
                    >
                        Retry
                    </Button>
                }
            />
        )
    }

    const data = previewQuery.data
    const errors = data?.errors ?? []
    const blocking = errors.filter(
        (error) => error.type === OwidGdocErrorMessageType.Error
    )
    const warnings = errors.filter(
        (error) => error.type !== OwidGdocErrorMessageType.Error
    )

    return (
        <div className="rich-editor-preview-wrapper">
            <div className="rich-editor-preview__toolbar">
                <Typography.Text type="secondary">
                    {previewQuery.isFetching
                        ? "Rendering preview…"
                        : "Preview of the current draft, rendered as it would appear on the site."}
                </Typography.Text>
                {data?.profileEntities && data.profileEntities.length > 0 && (
                    <Space size="small">
                        <Typography.Text type="secondary">
                            Entity
                        </Typography.Text>
                        <Select
                            size="small"
                            showSearch={{ optionFilterProp: "label" }}
                            style={{ minWidth: 220 }}
                            value={data.profileEntity?.code}
                            onChange={onEntityChange}
                            options={data.profileEntities.map((candidate) => ({
                                value: candidate.code,
                                label: candidate.name,
                            }))}
                        />
                    </Space>
                )}
            </div>
            {blocking.length > 0 && (
                <Alert
                    style={{ marginBottom: 12 }}
                    type="error"
                    showIcon
                    title={`${blocking.length} validation ${
                        blocking.length === 1 ? "error blocks" : "errors block"
                    } publishing`}
                    description={<ErrorList errors={blocking} />}
                />
            )}
            {warnings.length > 0 && (
                <Alert
                    style={{ marginBottom: 12 }}
                    type="warning"
                    showIcon
                    title={`${warnings.length} validation ${
                        warnings.length === 1 ? "warning" : "warnings"
                    }`}
                    description={<ErrorList errors={warnings} />}
                />
            )}
            <div className="rich-editor-preview">
                {data ? (
                    <AriaAnnouncerProvider>
                        <DebugProvider debug>
                            <OwidGdoc
                                // remount when the snapshot changes so
                                // site components reset their local state
                                key={`${version}-${entity ?? ""}`}
                                {...deserializeOwidGdocPageData(data.gdoc)}
                                isPreviewing
                            />
                        </DebugProvider>
                        <AriaAnnouncer />
                    </AriaAnnouncerProvider>
                ) : (
                    <div className="rich-editor-preview__status">
                        Rendering preview…
                    </div>
                )}
            </div>
        </div>
    )
}

function ErrorList(props: {
    errors: RichEditorPreviewResponse["errors"]
}): React.ReactElement {
    return (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
            {props.errors.map((error, index) => (
                <li key={index}>
                    <strong>{error.property}</strong>: {error.message}
                </li>
            ))}
        </ul>
    )
}
