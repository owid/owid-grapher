/**
 * Comment types for Google Docs comments in XHTML serialization.
 *
 * Comments are fetched via the Google Drive API and stored in the database
 * for internal bookkeeping and XHTML tooling. They are NOT rendered on the website.
 */

/**
 * A reply to a comment thread.
 */
export interface CommentReply {
    id: string
    author: string
    content: string
    createdTime: string // RFC 3339 timestamp
    modifiedTime: string
}

/**
 * A comment thread from Google Docs.
 * The quotedText field contains the exact text that was commented on,
 * allowing us to match comments to spans in the document.
 */
export interface CommentThread {
    id: string
    author: string
    content: string
    quotedText: string // The text that was commented on
    createdTime: string // RFC 3339 timestamp
    modifiedTime: string
    resolved: boolean
    replies: CommentReply[]
}

/**
 * Container for all comments associated with a Google Doc.
 */
export interface GdocComments {
    threads: CommentThread[]
    fetchedAt: string // RFC 3339 timestamp when comments were fetched
}
