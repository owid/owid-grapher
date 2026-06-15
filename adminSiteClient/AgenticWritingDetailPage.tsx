import { useContext, useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Button, Input } from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    HistoryResponse,
    VersionRecord,
    ViewContent,
    ViewDraft,
    ViewEditor,
    draftFromVersion,
    useReviewActions,
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

    // Decision / rewrite / editorial mutations shared with the queue page.
    const {
        submitDecision,
        saveRewrite,
        editorialMutation,
        decisionMutation,
        editMutation,
        dirty,
    } = useReviewActions({
        lineageKey: data?.lineageKey,
        latest,
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
        } else if (latest) {
            setDraft(draftFromVersion(latest))
            setEditing(true)
        }
    }, [editing, latest])

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
                    <div className="agentic-writing__empty">Loading…</div>
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
                                placeholder="Note — required for reject / request revisions; optional for approve"
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
                                onClick={() => submitDecision("approved")}
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
                                onClick={() =>
                                    submitDecision("request_revisions")
                                }
                            >
                                ↻ Revisions
                            </Button>
                            <Button
                                danger
                                disabled={!latest}
                                onClick={() => submitDecision("rejected")}
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
                            (isFocus ? " agentic-writing__version--focus" : "")
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
