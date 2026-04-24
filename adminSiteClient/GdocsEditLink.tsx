import * as React from "react"
import { faEdit, faFileCode } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Tag, Tooltip, message } from "antd"
import { GdocsContentSource } from "@ourworldindata/types"
import { CONTENT_REPO_PATH } from "../settings/clientSettings.js"

/**
 * Header affordance that reflects where the gdoc's content lives:
 *   - source='gdocs' → link to the Google Doc edit URL (existing behavior).
 *   - source='file'  → show the inferred repo path with a copy-to-clipboard
 *     action. The admin only knows the relative path pattern
 *     (`<type>/<slug>--<first-12-of-id>.md`); the full path is resolved
 *     server-side by CONTENT_REPO_PATH.
 */
export const GdocsEditLink = ({
    gdocId,
    source,
    slug,
    type,
    style,
}: {
    gdocId: string
    source?: string
    slug?: string
    type?: string
    style?: React.CSSProperties
}) => {
    if (source === GdocsContentSource.File) {
        const relPath =
            slug && type ? `${type}/${slug}--${gdocId.slice(0, 12)}.md` : null
        const absPath =
            relPath && CONTENT_REPO_PATH
                ? `${CONTENT_REPO_PATH.replace(/\/$/, "")}/${relPath}`
                : null
        // Opens a Claude Code session scoped to the content repo. `code/new`
        // doesn't accept a `file` parameter, so the file path is threaded into
        // the prompt. Claude Code is chosen over cowork because it has the
        // preview panel authors use for the edit-refresh loop. See
        // https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link
        const claudeUrl =
            absPath && relPath
                ? `claude://code/new?folder=${encodeURIComponent(CONTENT_REPO_PATH!)}&q=${encodeURIComponent(
                      `Open ${relPath} and help me edit it. Use the owid-content skill; consult the component registry before suggesting ArchieML.`
                  )}`
                : null
        // Fallback if CONTENT_REPO_PATH isn't configured on the client: show
        // the relative path with a copy-to-clipboard action so the author can
        // paste it into their editor of choice.
        if (!claudeUrl) {
            const copyPath = async () => {
                if (!relPath) return
                try {
                    await navigator.clipboard.writeText(relPath)
                    void message.success(`Copied: ${relPath}`)
                } catch {
                    void message.error("Copy failed")
                }
            }
            return (
                <Tooltip
                    title={relPath ? `Click to copy ${relPath}` : "File-backed"}
                >
                    <a
                        onClick={copyPath}
                        style={{ ...style, cursor: "pointer" }}
                        className="gdoc-edit-link"
                    >
                        <FontAwesomeIcon
                            style={{ marginRight: "0.4em" }}
                            icon={faFileCode}
                        />
                        File
                    </a>
                </Tooltip>
            )
        }
        const vscodeUrl = `vscode://file/${absPath}`
        return (
            <>
                <Tooltip title={`Opens ${relPath} in Claude Code`}>
                    <a
                        href={claudeUrl}
                        style={style}
                        className="gdoc-edit-link"
                    >
                        Edit in Claude
                        <FontAwesomeIcon
                            style={{ marginLeft: "0.4em" }}
                            icon={faEdit}
                        />
                    </a>
                </Tooltip>
                <span style={{ color: "#aaa", margin: "0 0.4em" }}>|</span>
                <Tooltip title={`Opens ${relPath} in VS Code`}>
                    <a
                        href={vscodeUrl}
                        style={style}
                        className="gdoc-edit-link"
                    >
                        VS Code
                    </a>
                </Tooltip>
            </>
        )
    }
    return (
        <a
            href={`https://docs.google.com/document/d/${gdocId}/edit`}
            target={gdocId}
            style={style}
            className="gdoc-edit-link"
            rel="noopener noreferrer"
        >
            Edit
            <FontAwesomeIcon style={{ marginLeft: "0.4em" }} icon={faEdit} />
        </a>
    )
}

/**
 * Small pill shown next to the title that tells the author/dev which source
 * the admin is rendering from. Color-coded: red for file (non-default), blue
 * for Gdocs (default).
 */
export const GdocsSourceBadge = ({ source }: { source?: string }) => {
    const isFile = source === GdocsContentSource.File
    return (
        <Tooltip
            title={
                isFile
                    ? "Content read from the content repo on disk. Refresh the preview after editing the file."
                    : "Content fetched from Google Docs. Refresh the preview to pull the latest revision."
            }
        >
            <Tag color={isFile ? "volcano" : "geekblue"}>
                <FontAwesomeIcon
                    style={{ marginRight: "0.4em" }}
                    icon={isFile ? faFileCode : faEdit}
                />
                {isFile ? "File" : "Google Docs"}
            </Tag>
        </Tooltip>
    )
}
