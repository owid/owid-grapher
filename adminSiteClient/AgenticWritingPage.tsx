import { useContext, useEffect, useMemo, useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Button, Input, Select } from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    HistoryResponse,
    ListItem,
    VersionRecord,
    ViewContent,
    ViewDraft,
    ViewEditor,
    draftFromVersion,
    useReviewActions,
    userHandle,
} from "./AgenticWritingShared.js"
import "./AgenticWritingPage.scss"

const STATUS_OPTIONS = [
    "unreviewed",
    "awaiting_review",
    "awaiting_revision",
    "approved",
    "rejected",
    "",
]

// Scope = editorial filter + ownership filter, bundled into one selector.
// - mine:      my private drafts (owner=me & editorial=private)
// - editorial: submitted, awaiting publication (everyone's)
// - published: published views (everyone's)
// - all:       no scope filter
type Scope = "mine" | "editorial" | "published" | "all"
const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
    { value: "mine", label: "My drafts" },
    { value: "editorial", label: "Editorial queue" },
    { value: "published", label: "Published" },
    { value: "all", label: "All" },
]

export function AgenticWritingPage() {
    const { admin } = useContext(AdminAppContext)

    const [scope, setScope] = useState<Scope>("mine")
    const [status, setStatus] = useState("")
    const [slug, setSlug] = useState("")
    const [idx, setIdx] = useState(0)
    const [comment, setComment] = useState("")
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState<ViewDraft | null>(null)

    const listQuery = useQuery({
        queryKey: ["agenticWriting", scope, status, slug],
        queryFn: async () => {
            const params: Record<string, string> = {}
            if (status) params.status = status
            if (slug.trim()) params.slug = slug.trim()
            if (scope === "mine") {
                params.owner = "me"
                params.editorial = "private"
            } else if (scope === "editorial") {
                params.editorial = "submitted"
            } else if (scope === "published") {
                params.editorial = "published"
            }
            return admin.getJSON<{ totalReturned: number; items: ListItem[] }>(
                "/api/agentic-writing.json",
                params
            )
        },
    })

    const slugsQuery = useQuery({
        queryKey: ["agenticWritingSlugs"],
        queryFn: () =>
            admin.getJSON<{ slugs: string[] }>(
                "/api/agentic-writing/slugs.json"
            ),
        staleTime: 60_000,
    })
    const slugOptions = useMemo(() => {
        const opts = [{ value: "", label: "all slugs" }]
        for (const s of slugsQuery.data?.slugs ?? [])
            opts.push({ value: s, label: s })
        return opts
    }, [slugsQuery.data])

    const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data])
    const current: ListItem | undefined = items[idx]

    // Keep idx in range whenever the list changes.
    useEffect(() => {
        if (idx > items.length - 1) setIdx(Math.max(0, items.length - 1))
    }, [items.length, idx])

    // Reset comment and any in-progress edit when the focused view changes.
    useEffect(() => {
        setComment("")
        setEditing(false)
        setDraft(null)
    }, [current?.lineageKey])

    const historyQuery = useQuery({
        queryKey: ["agenticWritingHistory", current?.lineageKey],
        queryFn: async () =>
            admin.getJSON<HistoryResponse>(
                `/api/agentic-writing/${encodeURIComponent(current!.lineageKey)}`
            ),
        enabled: !!current,
    })

    // Decision / rewrite / editorial mutations shared with the detail page.
    // On a decision the queue refetches; idx stays so the next item slides in.
    const {
        submitDecision,
        saveRewrite,
        editorialMutation,
        decisionMutation,
        editMutation,
        dirty,
    } = useReviewActions({
        lineageKey: current?.lineageKey,
        latest: current?.latest,
        comment,
        draft,
        editing,
        onDecided: () => setComment(""),
        onEdited: () => {
            setEditing(false)
            setDraft(null)
            setComment("")
        },
    })

    const toggleEdit = useCallback(() => {
        if (editing) {
            setEditing(false)
            setDraft(null)
        } else if (current) {
            setDraft(draftFromVersion(current.latest))
            setEditing(true)
        }
    }, [editing, current])

    const moveNext = useCallback(() => {
        if (items.length) setIdx((i) => Math.min(i + 1, items.length - 1))
    }, [items.length])
    const movePrev = useCallback(() => {
        setIdx((i) => Math.max(i - 1, 0))
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT"
            ) {
                if (e.key === "Escape") target.blur()
                return
            }
            if (e.metaKey || e.ctrlKey || e.altKey) return
            // While editing, suppress nav/decision shortcuts so a stray keypress
            // can't discard the draft. Use the on-screen buttons instead.
            if (editing) return
            switch (e.key) {
                case "j":
                case "ArrowRight":
                    e.preventDefault()
                    moveNext()
                    break
                case "k":
                case "ArrowLeft":
                    e.preventDefault()
                    movePrev()
                    break
                case "a":
                    e.preventDefault()
                    submitDecision("approved")
                    break
                case "r":
                    e.preventDefault()
                    submitDecision("request_revisions")
                    break
                case "x":
                    e.preventDefault()
                    submitDecision("rejected")
                    break
                case "e":
                    e.preventDefault()
                    toggleEdit()
                    break
                case "c": {
                    e.preventDefault()
                    const el = document.getElementById("iv-comment")
                    el?.focus()
                    break
                }
            }
        }
        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [moveNext, movePrev, submitDecision, editing, toggleEdit])

    return (
        <AdminLayout title="Agentic writing — playground">
            <main className="agentic-writing">
                <div className="agentic-writing__controls">
                    <span className="agentic-writing__progress">
                        {items.length > 0 ? (
                            <>
                                <strong>{idx + 1}</strong> of {items.length}
                            </>
                        ) : (
                            "0 in queue"
                        )}
                    </span>
                    <span>
                        Scope:{" "}
                        <Select
                            size="small"
                            value={scope}
                            style={{ width: 170 }}
                            onChange={(v) => {
                                setScope(v)
                                setIdx(0)
                            }}
                            options={SCOPE_OPTIONS}
                        />
                    </span>
                    <span>
                        Status:{" "}
                        <Select
                            size="small"
                            value={status}
                            style={{ width: 170 }}
                            onChange={(v) => {
                                setStatus(v)
                                setIdx(0)
                            }}
                            options={STATUS_OPTIONS.map((s) => ({
                                value: s,
                                label: s || "all",
                            }))}
                        />
                    </span>
                    <span>
                        Slug:{" "}
                        <Select
                            size="small"
                            style={{ width: 260 }}
                            value={slug}
                            onChange={(v) => {
                                setSlug(v)
                                setIdx(0)
                            }}
                            options={slugOptions}
                            showSearch
                            loading={slugsQuery.isLoading}
                        />
                    </span>
                    <span style={{ marginLeft: "auto", color: "#6b7280" }}>
                        Reviewer: {userHandle(admin.username, admin.email)}
                    </span>
                </div>

                {listQuery.isLoading ? (
                    <div className="agentic-writing__empty">Loading…</div>
                ) : !current ? (
                    <div className="agentic-writing__empty">
                        No views match the current filter.
                    </div>
                ) : editing && draft ? (
                    <ViewEditor draft={draft} onChange={setDraft} />
                ) : (
                    <ViewCard
                        item={current}
                        history={historyQuery.data?.versions ?? []}
                    />
                )}

                <div className="agentic-writing__actionbar">
                    <div className="agentic-writing__actionbar-row">
                        <Input.TextArea
                            id="iv-comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Note — required for reject / request revisions; optional for approve"
                            autoSize={{ minRows: 2, maxRows: 5 }}
                        />
                        <div className="agentic-writing__buttons">
                            {editing ? (
                                <>
                                    <Button onClick={toggleEdit}>Cancel</Button>
                                    <Button
                                        loading={editMutation.isPending}
                                        disabled={!dirty}
                                        onClick={saveRewrite}
                                    >
                                        💾 Save rewrite
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button onClick={movePrev}>‹ prev</Button>
                                    <Button onClick={toggleEdit}>
                                        ✎ Edit
                                        <span className="agentic-writing__kbd">
                                            e
                                        </span>
                                    </Button>
                                </>
                            )}
                            <Button
                                type="primary"
                                style={{
                                    background: "#16a34a",
                                    borderColor: "#16a34a",
                                }}
                                loading={
                                    decisionMutation.isPending ||
                                    editMutation.isPending
                                }
                                onClick={() => submitDecision("approved")}
                            >
                                ✓ Approve
                                <span className="agentic-writing__kbd">a</span>
                            </Button>
                            <Button
                                style={{
                                    background: "#ffedd5",
                                    borderColor: "#ea580c",
                                    color: "#ea580c",
                                }}
                                onClick={() =>
                                    submitDecision("request_revisions")
                                }
                            >
                                ↻ Revisions
                                <span className="agentic-writing__kbd">r</span>
                            </Button>
                            <Button
                                danger
                                onClick={() => submitDecision("rejected")}
                            >
                                ✗ Reject
                                <span className="agentic-writing__kbd">x</span>
                            </Button>
                            {!editing && current && (
                                <>
                                    {current.editorial === "private" && (
                                        <Button
                                            loading={
                                                editorialMutation.isPending
                                            }
                                            onClick={() =>
                                                editorialMutation.mutate(
                                                    "submit"
                                                )
                                            }
                                        >
                                            → Submit
                                        </Button>
                                    )}
                                    {current.editorial === "submitted" &&
                                        current.latest.review.decision ===
                                            "approved" && (
                                            <Button
                                                type="primary"
                                                style={{
                                                    background: "#065f46",
                                                    borderColor: "#065f46",
                                                }}
                                                loading={
                                                    editorialMutation.isPending
                                                }
                                                onClick={() =>
                                                    editorialMutation.mutate(
                                                        "publish"
                                                    )
                                                }
                                            >
                                                ✦ Publish
                                            </Button>
                                        )}
                                    <Button onClick={moveNext}>next ›</Button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="agentic-writing__help">
                        Keys: <span className="agentic-writing__kbd">j</span>/
                        <span className="agentic-writing__kbd">k</span>{" "}
                        next/prev ·{" "}
                        <span className="agentic-writing__kbd">a</span>/
                        <span className="agentic-writing__kbd">r</span>/
                        <span className="agentic-writing__kbd">x</span>{" "}
                        approve/revise/reject ·{" "}
                        <span className="agentic-writing__kbd">e</span> edit ·{" "}
                        <span className="agentic-writing__kbd">c</span> comment
                        {editing && (
                            <>
                                {" "}
                                · editing: shortcuts paused — use the buttons.
                                When you’ve changed something, “Save rewrite”
                                stores a new revision (awaiting review), or
                                Approve/Revisions/Reject applies your rewrite
                                then the decision.
                            </>
                        )}
                    </div>
                </div>
            </main>
        </AdminLayout>
    )
}

function ViewCard({
    item,
    history,
}: {
    item: ListItem
    history: VersionRecord[]
}) {
    return (
        <article>
            <ViewContent
                version={item.latest}
                status={item.status}
                editorial={item.editorial}
                ownerEmail={item.ownerEmail}
                ownerName={item.ownerName}
            />

            <div className="agentic-writing__detail-link">
                <Link
                    to={`/agentic-writing/view/${encodeURIComponent(item.lineageKey)}`}
                >
                    Open detail & full history ↗
                </Link>
            </div>

            {history.length > 1 && (
                <details>
                    <summary style={{ cursor: "pointer", color: "#6b7280" }}>
                        Version history ({history.length})
                    </summary>
                    {history.map((ver) => (
                        <div
                            className="agentic-writing__version"
                            key={ver.versionId}
                        >
                            <div>
                                <Link
                                    to={`/agentic-writing/view/${encodeURIComponent(item.lineageKey)}#${ver.versionId}`}
                                >
                                    <strong>{ver.versionId}</strong>
                                </Link>{" "}
                                — {ver.kind}
                                {ver.review?.decision
                                    ? ` · ${ver.review.decision}`
                                    : ""}
                            </div>
                            <div style={{ color: "#6b7280", fontSize: 11 }}>
                                {ver.createdAt} · by{" "}
                                {userHandle(ver.createdByName, ver.createdBy)}
                            </div>
                            {ver.review?.comment && (
                                <div className="agentic-writing__version-comment">
                                    {ver.review.comment}
                                </div>
                            )}
                        </div>
                    ))}
                </details>
            )}
        </article>
    )
}
