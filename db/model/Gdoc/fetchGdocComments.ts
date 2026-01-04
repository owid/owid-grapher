import { drive as googleDrive, type drive_v3 } from "@googleapis/drive"
import {
    CommentReply,
    CommentThread,
    GdocComments,
} from "@ourworldindata/types"
import { OwidGoogleAuth } from "../../OwidGoogleAuth.js"

/**
 * Fetch comments from a Google Doc via the Drive API.
 *
 * Comments are fetched via the Drive API (not the Docs API) because that's
 * where Google stores comment data. The `quotedFileContent.value` field
 * contains the exact text that was commented on, allowing us to match
 * comments to spans in the document.
 *
 * @param documentId - The Google Docs document ID
 * @returns GdocComments structure, or null if fetching fails
 */
export async function fetchGdocComments(
    documentId: string
): Promise<GdocComments | null> {
    if (!OwidGoogleAuth.areGdocAuthKeysSet()) {
        console.warn("Google auth keys not set, skipping comment fetch")
        return null
    }

    try {
        const driveClient = googleDrive({
            version: "v3",
            auth: OwidGoogleAuth.getGoogleReadonlyAuth(),
        })

        const threads: CommentThread[] = []
        let pageToken: string | undefined

        // Paginate through all comments (max 100 per page)
        do {
            const response: { data: drive_v3.Schema$CommentList } =
                await driveClient.comments.list({
                    fileId: documentId,
                    fields: "comments(id,author,content,quotedFileContent,createdTime,modifiedTime,resolved,replies),nextPageToken",
                    pageSize: 100,
                    pageToken,
                })

            const comments = response.data.comments ?? []

            for (const comment of comments) {
                const thread: CommentThread = {
                    id: comment.id ?? "",
                    author:
                        comment.author?.emailAddress ??
                        comment.author?.displayName ??
                        "",
                    content: comment.content ?? "",
                    quotedText: comment.quotedFileContent?.value ?? "",
                    createdTime: comment.createdTime ?? "",
                    modifiedTime: comment.modifiedTime ?? "",
                    resolved: comment.resolved ?? false,
                    replies: (comment.replies ?? []).map(
                        (reply): CommentReply => ({
                            id: reply.id ?? "",
                            author:
                                reply.author?.emailAddress ??
                                reply.author?.displayName ??
                                "",
                            content: reply.content ?? "",
                            createdTime: reply.createdTime ?? "",
                            modifiedTime: reply.modifiedTime ?? "",
                        })
                    ),
                }
                threads.push(thread)
            }

            pageToken = response.data.nextPageToken ?? undefined
        } while (pageToken)

        return {
            threads,
            fetchedAt: new Date().toISOString(),
        }
    } catch (error) {
        console.error(
            `Error fetching comments for document ${documentId}:`,
            error
        )
        return null
    }
}
