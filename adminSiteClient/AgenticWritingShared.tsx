// Shared types and rendering for the agentic-writing playground:
// the queue page (AgenticWritingPage) and the per-lineage detail page
// (AgenticWritingDetailPage). Keep the visual rendering here so both stay in
// sync. The current implementation focuses on the data-nugget content type;
// other content types (when added) would extend the type union and the
// renderer.

import { Button, Input, Select } from "antd"

const GRAPHER_BASE = "https://ourworldindata.org/grapher"

export type Decision = "approved" | "rejected" | "request_revisions"
export type EditorialState = "private" | "submitted" | "published"
export type ContentType = "data_nugget"

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
    kind: string
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
                <div className="agentic-writing__chart-title">
                    {gv.caption}
                </div>
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
}: {
    version: VersionRecord
    status: string
    editorial?: EditorialState
    ownerEmail?: string
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
                {ownerEmail && (
                    <span className="agentic-writing__badge agentic-writing__badge--entities">
                        @{ownerEmail}
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
