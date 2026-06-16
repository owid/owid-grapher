/* eslint-disable react-refresh/only-export-components */
// Shared types and rendering for the agentic-writing playground:
// the queue page (AgenticWritingPage) and the per-lineage detail page
// (AgenticWritingDetailPage). Keep the visual rendering here so both stay in
// sync. The current implementation focuses on the data-nugget content type;
// other content types (when added) would extend the type union and the
// renderer.

import { useCallback, useContext, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button, Input, Select, notification } from "antd"
import {
    AgenticWritingContentType,
    AgenticWritingDecision,
    AgenticWritingVersionKind,
} from "@ourworldindata/types"
import { AdminAppContext } from "./AdminAppContext.js"

const GRAPHER_BASE = "https://ourworldindata.org/grapher"

export type Decision = AgenticWritingDecision
export type EditorialState = "private" | "submitted" | "published"
export type ContentType = AgenticWritingContentType

// Display a user as a compact "@first-last" handle derived from their full
// name, e.g. "Bobbie Macdonald" -> "@bobbie-macdonald". Falls back to the
// local part of an email ("user-47@example.com" -> "@user-47"), and shows a
// non-email agent label (e.g. "claude-fable-5") verbatim. Avoids surfacing raw
// emails — which on staging are anonymised to {id}@example.com.
export function userHandle(
    name?: string | null,
    fallbackLabel?: string | null
): string {
    const n = (name ?? "").trim()
    if (n && !n.includes("@")) {
        const slug = n
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
        if (slug) return `@${slug}`
    }
    const fb = (fallbackLabel ?? "").trim() || n
    if (!fb) return "unknown"
    if (fb.includes("@")) return `@${fb.split("@")[0]}`
    return fb
}

export interface GrapherView {
    slug: string
    url: string
    queryParams: Record<string, string>
    caption: string | null
}

export interface FactCheckIssue {
    field: string
    severity: string
    claim: string
    actual: string
    resolution: string
}

// Data-nugget-specific payload shape. Other content types would have different shapes.
export interface DataNuggetPayload {
    grapherViews: GrapherView[]
}

export interface VersionRecord {
    lineageKey: string
    contentType: ContentType
    versionId: string
    parentVersionId: string | null
    createdAt: string
    createdBy: string
    createdByName: string | null
    kind: AgenticWritingVersionKind
    title: string
    description: string
    payload: DataNuggetPayload // discriminated by contentType when more types exist
    metadata: {
        entities?: string[]
        keyInsightLevel?: string | null
        grapherSlugs?: string[]
        factCheck?: {
            status: string
            issues?: FactCheckIssue[]
        } | null
    }
    review: {
        decision: Decision | null
        comment: string | null
        reviewedAt: string | null
        reviewedBy: string | null
    }
}

export interface ListItem {
    lineageKey: string
    contentType: ContentType
    status: string
    editorial: EditorialState
    ownerEmail: string
    ownerName: string
    ownerUserId: number
    versionCount: number
    latest: VersionRecord
}

export interface HistoryResponse {
    lineageKey: string
    contentType: ContentType
    status: string
    editorial: EditorialState
    ownerEmail: string
    ownerName: string
    ownerUserId: number
    versions: VersionRecord[]
}

export function thumbnailUrl(gv: GrapherView): string {
    const params = new URLSearchParams(gv.queryParams || {})
    params.set("imType", "thumbnail")
    return `${GRAPHER_BASE}/${gv.slug}.png?${params.toString()}`
}

function ChartTile({ gv }: { gv: GrapherView }) {
    return (
        <div className="agentic-writing__chart-tile">
            {gv.caption && (
                <div className="agentic-writing__chart-title">{gv.caption}</div>
            )}
            <a
                className="agentic-writing__chart-media"
                href={gv.url}
                target="_blank"
                rel="noopener noreferrer"
            >
                <img src={thumbnailUrl(gv)} alt={gv.slug} loading="lazy" />
                <span className="agentic-writing__open-link">open ↗</span>
            </a>
        </div>
    )
}

// Renders the title / description / charts / metadata of a single version.
// Used for the "current version" view on both review surfaces.
export function ViewContent({
    version,
    status,
    editorial,
    ownerEmail,
    ownerName,
}: {
    version: VersionRecord
    status: string
    editorial?: EditorialState
    ownerEmail?: string
    ownerName?: string
}) {
    const charts = version.payload?.grapherViews ?? []
    const isMulti = charts.length > 1
    const lvl = version.metadata?.keyInsightLevel
    const entities = version.metadata?.entities ?? []
    const fc = version.metadata?.factCheck

    const textBlock = (
        <div className="agentic-writing__text">
            <h2 className="agentic-writing__title">{version.title}</h2>
            <p className="agentic-writing__description">
                {version.description}
            </p>

            <div className="agentic-writing__meta">
                <span
                    className={`agentic-writing__badge agentic-writing__badge--${status === "approved" ? "notable" : "entities"}`}
                >
                    {status}
                </span>
                {editorial && (
                    <span
                        className={`agentic-writing__badge agentic-writing__badge--editorial-${editorial}`}
                    >
                        {editorial}
                    </span>
                )}
                {(ownerName || ownerEmail) && (
                    <span className="agentic-writing__badge agentic-writing__badge--entities">
                        {userHandle(ownerName, ownerEmail)}
                    </span>
                )}
                {lvl === "key" && (
                    <span className="agentic-writing__badge agentic-writing__badge--key">
                        key
                    </span>
                )}
                {lvl === "notable" && (
                    <span className="agentic-writing__badge agentic-writing__badge--notable">
                        notable
                    </span>
                )}
                {isMulti && (
                    <span className="agentic-writing__badge agentic-writing__badge--multi">
                        {charts.length} charts
                    </span>
                )}
                {entities.length > 0 && (
                    <span className="agentic-writing__badge agentic-writing__badge--entities">
                        {entities.join(" · ")}
                    </span>
                )}
                <span>{version.lineageKey}</span>
            </div>

            {fc && (fc.status !== "passed" || (fc.issues ?? []).length > 0) && (
                <div className="agentic-writing__factcheck">
                    <strong>Fact-check: {fc.status}</strong>
                    {(fc.issues ?? []).map((iss, i) => (
                        <div
                            className="agentic-writing__factcheck-issue"
                            key={i}
                        >
                            <strong>{iss.field}</strong> — {iss.claim}
                            <div>{iss.actual}</div>
                            <div style={{ color: "#6b7280", fontSize: 11 }}>
                                {iss.severity} · {iss.resolution}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )

    if (isMulti) {
        return (
            <>
                {textBlock}
                <div className="agentic-writing__charts agentic-writing__charts--row">
                    {charts.map((gv, i) => (
                        <ChartTile gv={gv} key={i} />
                    ))}
                </div>
            </>
        )
    }

    return (
        <div className="agentic-writing__single">
            {charts[0] && <ChartTile gv={charts[0]} />}
            {textBlock}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Inline reviewer rewrite: editable counterpart to ViewContent.
// Currently data-nugget-specific. When more content types are added, this
// would dispatch by contentType to a type-specific editor.
// ---------------------------------------------------------------------------

export interface ChartRowDraft {
    url: string
    caption: string
}

export interface ViewDraft {
    title: string
    description: string
    keyInsightLevel: "key" | "notable" | "" // "" === null
    entities: string
    charts: ChartRowDraft[]
}

export function parseGrapherUrl(rawUrl: string): GrapherView {
    const u = new URL(rawUrl.trim())
    const slug = u.pathname.replace(/^\/grapher\//, "").replace(/\/+$/, "")
    if (!slug) throw new Error("missing chart slug")
    const queryParams: Record<string, string> = {}
    u.searchParams.forEach((v, k) => (queryParams[k] = v))
    const search = u.searchParams.toString()
    const url = `${GRAPHER_BASE}/${slug}${search ? `?${search}` : ""}`
    return { slug, url, queryParams, caption: null }
}

export function isChartUrlValid(rawUrl: string): boolean {
    try {
        parseGrapherUrl(rawUrl)
        return true
    } catch {
        return false
    }
}

export function isDraftValid(draft: ViewDraft): boolean {
    if (!draft.title.trim() || !draft.description.trim()) return false
    if (draft.charts.length === 0) return false
    return draft.charts.every((c) => isChartUrlValid(c.url))
}

export function draftFromVersion(v: VersionRecord): ViewDraft {
    const lvl = v.metadata?.keyInsightLevel
    return {
        title: v.title ?? "",
        description: v.description ?? "",
        keyInsightLevel: lvl === "key" || lvl === "notable" ? lvl : "",
        entities: (v.metadata?.entities ?? []).join(", "),
        charts: (v.payload?.grapherViews ?? []).map((gv) => ({
            url: gv.url,
            caption: gv.caption ?? "",
        })),
    }
}

// Serialize a draft into the /edits request body fields. Returns the
// content-type-specific payload + common fields. Spreads the prior metadata
// first so untouched keys (factCheck, grapherSlugs, refinement) survive.
export function draftToEditPayload(
    draft: ViewDraft,
    latest: VersionRecord
): {
    title: string
    description: string
    payload: DataNuggetPayload
    metadata: Record<string, unknown>
} {
    const entities = draft.entities
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    const grapherViews = draft.charts.map((row) => ({
        ...parseGrapherUrl(row.url),
        caption: row.caption.trim() || null,
    }))
    return {
        title: draft.title.trim(),
        description: draft.description.trim(),
        payload: { grapherViews },
        metadata: {
            ...latest.metadata,
            keyInsightLevel: draft.keyInsightLevel || null,
            entities,
        },
    }
}

// ---------------------------------------------------------------------------
// Shared review actions: decision / rewrite / editorial mutations with
// uniform validation, success toasts, error surfacing, and cache invalidation.
// Used by both the queue page and the detail page so they can't drift apart.
// ---------------------------------------------------------------------------

const INVALID_DRAFT_MESSAGE =
    "Fix the view first: title, description, and a valid chart URL are required"

export function useReviewActions({
    lineageKey,
    latest,
    comment,
    draft,
    editing,
    onDecided,
    onEdited,
}: {
    lineageKey: string | undefined
    latest: VersionRecord | undefined
    comment: string
    draft: ViewDraft | null
    editing: boolean
    onDecided: () => void
    onEdited: () => void
}) {
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()

    const apiPath = lineageKey
        ? `/api/agentic-writing/${encodeURIComponent(lineageKey)}`
        : null

    const invalidate = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: ["agenticWriting"] })
        void queryClient.invalidateQueries({
            queryKey: ["agenticWritingHistory"],
        })
    }, [queryClient])

    // Surface failures (e.g. a 409 stale-version conflict when someone else
    // reviewed first) instead of silently doing nothing, and refetch so the
    // newer state is on screen.
    const onError = useCallback(
        (err: unknown) => {
            notification.error({
                message: "Action failed",
                description: err instanceof Error ? err.message : String(err),
                placement: "bottomRight",
            })
            invalidate()
        },
        [invalidate]
    )

    const decisionMutation = useMutation({
        mutationFn: async (vars: { decision: Decision }) => {
            if (!apiPath || !latest) return
            return admin.requestJSON(
                `${apiPath}/decisions`,
                {
                    decision: vars.decision,
                    comment: comment.trim() || null,
                    parentVersionId: latest.versionId,
                },
                "POST"
            )
        },
        onSuccess: (_d, vars) => {
            notification.success({
                message: vars.decision.replace("_", " "),
                placement: "bottomRight",
                duration: 1.2,
            })
            onDecided()
            invalidate()
        },
        onError,
    })

    // Reviewer rewrite: posts the edited content (and an optional decision) to
    // the /edits endpoint, which writes a revision and stacks the decision.
    const editMutation = useMutation({
        mutationFn: async (vars: { decision?: Decision }) => {
            if (!apiPath || !latest || !draft) return
            const payload = draftToEditPayload(draft, latest)
            return admin.requestJSON(
                `${apiPath}/edits`,
                {
                    ...payload,
                    parentVersionId: latest.versionId,
                    decision: vars.decision ?? null,
                    comment: comment.trim() || null,
                },
                "POST"
            )
        },
        onSuccess: (_d, vars) => {
            notification.success({
                message: vars.decision
                    ? `rewrite + ${vars.decision.replace("_", " ")}`
                    : "rewrite saved",
                placement: "bottomRight",
                duration: 1.2,
            })
            onEdited()
            invalidate()
        },
        onError,
    })

    // Editorial transitions: submit (private → submitted) and
    // publish (submitted → published).
    const editorialMutation = useMutation({
        mutationFn: async (action: "submit" | "publish") => {
            if (!apiPath) return
            return admin.requestJSON(`${apiPath}/${action}`, {}, "POST")
        },
        onSuccess: (_d, action) => {
            notification.success({
                message: action === "submit" ? "submitted" : "published",
                placement: "bottomRight",
                duration: 1.2,
            })
            invalidate()
        },
        onError,
    })

    // Has the reviewer actually changed anything? Both sides go through the
    // same normalization so formatting differences don't count as edits.
    const dirty = useMemo(() => {
        if (!editing || !draft || !latest) return false
        return (
            JSON.stringify(draftFromVersion(latest)) !== JSON.stringify(draft)
        )
    }, [editing, draft, latest])

    // Validate then dispatch a decision. When the reviewer has edited content,
    // apply the rewrite first and stack the decision on top; otherwise it's a
    // plain decision. Mirrors the server rule: reject and request-revisions
    // both require a reason.
    const submitDecision = useCallback(
        (decision: Decision) => {
            if (!latest) return
            if (decision !== "approved" && !comment.trim()) {
                notification.warning({
                    message:
                        decision === "rejected"
                            ? "Reason required to reject"
                            : "Comment required to request revisions",
                    placement: "bottomRight",
                })
                return
            }
            if (editing && dirty) {
                if (draft && !isDraftValid(draft)) {
                    notification.warning({
                        message: INVALID_DRAFT_MESSAGE,
                        placement: "bottomRight",
                    })
                    return
                }
                editMutation.mutate({ decision })
            } else {
                decisionMutation.mutate({ decision })
            }
        },
        [latest, comment, editing, dirty, draft, editMutation, decisionMutation]
    )

    const saveRewrite = useCallback(() => {
        if (!latest || !draft) return
        if (!isDraftValid(draft)) {
            notification.warning({
                message: INVALID_DRAFT_MESSAGE,
                placement: "bottomRight",
            })
            return
        }
        editMutation.mutate({})
    }, [latest, draft, editMutation])

    return {
        submitDecision,
        saveRewrite,
        editorialMutation,
        decisionMutation,
        editMutation,
        dirty,
    }
}

export function ViewEditor({
    draft,
    onChange,
}: {
    draft: ViewDraft
    onChange: (next: ViewDraft) => void
}) {
    const update = (patch: Partial<ViewDraft>) =>
        onChange({ ...draft, ...patch })
    const setChart = (i: number, patch: Partial<ChartRowDraft>) =>
        update({
            charts: draft.charts.map((c, idx) =>
                idx === i ? { ...c, ...patch } : c
            ),
        })
    const addChart = () =>
        update({ charts: [...draft.charts, { url: "", caption: "" }] })
    const removeChart = (i: number) =>
        update({ charts: draft.charts.filter((_, idx) => idx !== i) })

    return (
        <div className="agentic-writing__editor">
            <div className="agentic-writing__field">
                <label className="agentic-writing__field-label">Title</label>
                <Input
                    value={draft.title}
                    onChange={(e) => update({ title: e.target.value })}
                />
            </div>
            <div className="agentic-writing__field">
                <label className="agentic-writing__field-label">
                    Description
                </label>
                <Input.TextArea
                    value={draft.description}
                    onChange={(e) => update({ description: e.target.value })}
                    autoSize={{ minRows: 2, maxRows: 6 }}
                />
            </div>
            <div className="agentic-writing__field">
                <label className="agentic-writing__field-label">
                    Key insight level
                </label>
                <Select
                    value={draft.keyInsightLevel}
                    style={{ width: 160 }}
                    onChange={(v) => update({ keyInsightLevel: v })}
                    options={[
                        { value: "", label: "none" },
                        { value: "notable", label: "notable" },
                        { value: "key", label: "key" },
                    ]}
                />
            </div>
            <div className="agentic-writing__field">
                <label className="agentic-writing__field-label">
                    Entities (comma-separated)
                </label>
                <Input
                    value={draft.entities}
                    placeholder="e.g. OWID_WRL, NER"
                    onChange={(e) => update({ entities: e.target.value })}
                />
            </div>
            <div className="agentic-writing__field">
                <label className="agentic-writing__field-label">Charts</label>
                <div className="agentic-writing__chart-rows">
                    {draft.charts.map((row, i) => {
                        let preview: string | null = null
                        try {
                            preview = thumbnailUrl(parseGrapherUrl(row.url))
                        } catch {
                            preview = null
                        }
                        const invalid =
                            row.url.trim() !== "" && preview === null
                        return (
                            <div
                                className={
                                    "agentic-writing__chart-row" +
                                    (invalid
                                        ? " agentic-writing__chart-row--invalid"
                                        : "")
                                }
                                key={i}
                            >
                                {preview ? (
                                    <img
                                        className="agentic-writing__chart-row-preview"
                                        src={preview}
                                        alt=""
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="agentic-writing__chart-row-preview" />
                                )}
                                <div className="agentic-writing__chart-row-fields">
                                    <Input
                                        value={row.url}
                                        status={invalid ? "error" : undefined}
                                        placeholder="https://ourworldindata.org/grapher/slug?tab=line&country=~OWID_WRL"
                                        onChange={(e) =>
                                            setChart(i, {
                                                url: e.target.value,
                                            })
                                        }
                                    />
                                    <Input
                                        value={row.caption}
                                        placeholder="Caption (optional)"
                                        onChange={(e) =>
                                            setChart(i, {
                                                caption: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <Button
                                    className="agentic-writing__chart-row-remove"
                                    danger
                                    size="small"
                                    onClick={() => removeChart(i)}
                                >
                                    remove
                                </Button>
                            </div>
                        )
                    })}
                </div>
                <Button
                    className="agentic-writing__add-chart"
                    size="small"
                    onClick={addChart}
                >
                    + Add chart
                </Button>
            </div>
        </div>
    )
}
