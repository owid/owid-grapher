import { useContext, useMemo, useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Button, Input, notification } from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    Decision,
    HistoryResponse,
    VersionRecord,
    ViewContent,
    ViewDraft,
    ViewEditor,
    draftFromVersion,
    draftToEditPayload,
    isDraftValid,
} from "./AgenticWritingShared.js"
import "./AgenticWritingPage.scss"

// Detail page for a single view (lineage), reachable at
// /agentic-writing/view/:lineageKey. Shows the view's current version, its
// full (immutable) version history, and the approve / request-revisions /
// reject controls. An optional URL hash (#versionId) highlights one version in
// the history so links from the queue can land on a specific point in time.
// The reviewer can also rewrite the view inline (see ViewEditor) and save it as
// a new revision, optionally combined with a decision via the /edits endpoint.
export function AgenticWritingDetailPage({
    lineageKey,
}: {
    lineageKey: string
}) {
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()
    const [comment, setComment] = useState("")
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState<ViewDraft | null>(null)

    const focusVersionId = window.location.hash.replace(/^#/, "") || null

    const query = useQuery({
        queryKey: ["agenticWritingHistory", lineageKey],
        queryFn: async () =>
            admin.getJSON<HistoryResponse>(
                `/api/agentic-writing/${encodeURIComponent(lineageKey)}`
            ),
    })

    const data = query.data
    const versions = data?.versions ?? []
    const latest = versions[versions.length - 1]

    const decisionMutation = useMutation({
        mutationFn: async (vars: { decision: Decision }) => {
            if (!data || !latest) return
            return admin.requestJSON(
                `/api/agentic-writing/${encodeURIComponent(data.lineageKey)}/decisions`,
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
            setComment("")
            void queryClient.invalidateQueries({
                queryKey: ["agenticWritingHistory", lineageKey],
            })
            void queryClient.invalidateQueries({
                queryKey: ["agenticWriting"],
            })
        },
    })

    // Reviewer rewrite: posts the edited content (and an optional decision) to
    // the /edits endpoint, which writes a revision and stacks the decision.
    const editMutation = useMutation({
        mutationFn: async (vars: { decision?: Decision }) => {
            if (!data || !latest || !draft) return
            const payload = draftToEditPayload(draft, latest)
            return admin.requestJSON(
                `/api/agentic-writing/${encodeURIComponent(data.lineageKey)}/edits`,
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
            setEditing(false)
            setDraft(null)
            setComment("")
            void queryClient.invalidateQueries({
                queryKey: ["agenticWritingHistory", lineageKey],
            })
            void queryClient.invalidateQueries({
                queryKey: ["agenticWriting"],
            })
        },
    })

    const dirty = useMemo(() => {
        if (!editing || !draft || !latest) return false
        return (
            JSON.stringify(draftFromVersion(latest)) !== JSON.stringify(draft)
        )
    }, [editing, draft, latest])

    const toggleEdit = useCallback(() => {
        if (editing) {
            setEditing(false)
            setDraft(null)
        } else if (latest) {
            setDraft(draftFromVersion(latest))
            setEditing(true)
        }
    }, [editing, latest])

    const submit = useCallback(
        (decision: Decision) => {
            if (!latest) return
            if (decision === "request_revisions" && !comment.trim()) {
                notification.warning({
                    message: "Comment required to request revisions",
                    placement: "bottomRight",
                })
                return
            }
            if (editing && dirty) {
                if (draft && !isDraftValid(draft)) {
                    notification.warning({
                        message:
                            "Fix the view first: title, description, and a valid chart URL are required",
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
                message:
                    "Fix the view first: title, description, and a valid chart URL are required",
                placement: "bottomRight",
            })
            return
        }
        editMutation.mutate({})
    }, [latest, draft, editMutation])

    const editorialMutation = useMutation({
        mutationFn: async (action: "submit" | "publish") => {
            if (!data) return
            return admin.requestJSON(
                `/api/agentic-writing/${encodeURIComponent(data.lineageKey)}/${action}`,
                {},
                "POST"
            )
        },
        onSuccess: (_d, action) => {
            notification.success({
                message: action === "submit" ? "submitted" : "published",
                placement: "bottomRight",
                duration: 1.2,
            })
            void queryClient.invalidateQueries({
                queryKey: ["agenticWritingHistory", lineageKey],
            })
            void queryClient.invalidateQueries({
                queryKey: ["agenticWriting"],
            })
        },
    })

    const isTerminal = latest?.kind === "decision"

    return (
        <AdminLayout title="Agentic writing — detail">
            <main className="agentic-writing">
                <div className="agentic-writing__controls">
                    <Link to="/agentic-writing">‹ Back to playground</Link>
                    {data && (
                        <span className="agentic-writing__progress">
                            status: <strong>{data.status}</strong> ·{" "}
                            {versions.length} version
                            {versions.length === 1 ? "" : "s"}
                        </span>
                    )}
                    <span style={{ marginLeft: "auto", color: "#6b7280" }}>
                        Reviewer: {admin.email}
                    </span>
                </div>

                {query.isLoading ? (
                    <div className="agentic-writing__empty">
                        Loading…
                    </div>
                ) : query.isError || !data || !latest ? (
                    <div className="agentic-writing__empty">
                        No view found for <code>{lineageKey}</code>.
                    </div>
                ) : editing && draft ? (
                    <ViewEditor draft={draft} onChange={setDraft} />
                ) : (
                    <>
                        <ViewContent
                            version={latest}
                            status={data.status}
                            editorial={data.editorial}
                            ownerEmail={data.ownerEmail}
                        />

                        <VersionHistory
                            versions={versions}
                            focusVersionId={focusVersionId}
                            latestVersionId={latest.versionId}
                        />
                    </>
                )}

                <div className="agentic-writing__actionbar">
                    <div className="agentic-writing__actionbar-row">
                        <div>
                            {isTerminal && (
                                <div className="agentic-writing__terminal-note">
                                    Latest version is already a decision (
                                    {latest?.review.decision?.replace("_", " ")}
                                    ). A new decision stacks on top of it.
                                </div>
                            )}
                            <Input.TextArea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Comment (required for 'request revisions'; optional otherwise)"
                                autoSize={{ minRows: 2, maxRows: 5 }}
                            />
                        </div>
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
                                <Button disabled={!latest} onClick={toggleEdit}>
                                    ✎ Edit
                                </Button>
                            )}
                            <Button
                                type="primary"
                                style={{
                                    background: "#16a34a",
                                    borderColor: "#16a34a",
                                }}
                                disabled={!latest}
                                loading={
                                    decisionMutation.isPending ||
                                    editMutation.isPending
                                }
                                onClick={() => submit("approved")}
                            >
                                ✓ Approve
                            </Button>
                            <Button
                                style={{
                                    background: "#ffedd5",
                                    borderColor: "#ea580c",
                                    color: "#ea580c",
                                }}
                                disabled={!latest}
                                onClick={() => submit("request_revisions")}
                            >
                                ↻ Revisions
                            </Button>
                            <Button
                                danger
                                disabled={!latest}
                                onClick={() => submit("rejected")}
                            >
                                ✗ Reject
                            </Button>
                            {!editing && data && (
                                <>
                                    {data.editorial === "private" && (
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
                                    {data.editorial === "submitted" &&
                                        latest?.review.decision ===
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
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </AdminLayout>
    )
}

function VersionHistory({
    versions,
    focusVersionId,
    latestVersionId,
}: {
    versions: VersionRecord[]
    focusVersionId: string | null
    latestVersionId: string
}) {
    return (
        <section className="agentic-writing__history">
            <h3 className="agentic-writing__history-heading">
                Version history ({versions.length})
            </h3>
            {versions.map((ver) => {
                const isFocus = ver.versionId === focusVersionId
                const isLatest = ver.versionId === latestVersionId
                return (
                    <div
                        className={
                            "agentic-writing__version" +
                            (isFocus
                                ? " agentic-writing__version--focus"
                                : "")
                        }
                        key={ver.versionId}
                        id={ver.versionId}
                    >
                        <div>
                            <strong>{ver.versionId}</strong> — {ver.kind}
                            {ver.review?.decision
                                ? ` · ${ver.review.decision}`
                                : ""}
                            {isLatest && (
                                <span className="agentic-writing__badge agentic-writing__badge--notable agentic-writing__version-tag">
                                    current
                                </span>
                            )}
                            {isFocus && !isLatest && (
                                <span className="agentic-writing__badge agentic-writing__badge--entities agentic-writing__version-tag">
                                    linked
                                </span>
                            )}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 11 }}>
                            {ver.createdAt} · by {ver.createdBy}
                        </div>
                        <div className="agentic-writing__version-title">
                            {ver.title}
                        </div>
                        <div className="agentic-writing__version-desc">
                            {ver.description}
                        </div>
                        {ver.review?.comment && (
                            <div className="agentic-writing__version-comment">
                                {ver.review.comment}
                            </div>
                        )}
                    </div>
                )
            })}
        </section>
    )
}
