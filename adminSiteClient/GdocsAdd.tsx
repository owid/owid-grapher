import { GDOCS_URL_PLACEHOLDER, gdocUrlRegex } from "@ourworldindata/utils"
import * as React from "react"
import {
    GDOCS_ARTICLE_DUPLICATION_TEMPLATE_ID,
    GDOCS_CLIENT_EMAIL,
    GDOCS_DATA_INSIGHT_DUPLICATION_TEMPLATE_ID,
    GDOCS_ANNOUNCEMENT_DUPLICATION_TEMPLATE_ID,
} from "../settings/clientSettings.js"
import { useGdocsStore } from "./GdocsStoreContext.js"

export const GdocsAdd = ({ onAdd }: { onAdd: (id: string) => void }) => {
    const [documentUrl, setDocumentUrl] = React.useState("")
    const store = useGdocsStore()

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const [, id] = documentUrl.match(gdocUrlRegex) || []

        // fallback for HTML5 validation below
        if (!id) return

        await store.create(id)
        onAdd(id)
    }
    return (
        <form className="GdocsAddForm" onSubmit={onSubmit}>
            <div className="modal-header">
                <h5 className="modal-title">Add a document</h5>
            </div>
            <div className="modal-body">
                <div className="GdocsAddForm__instructions">
                    <p>
                        You can share a Google Doc with{" "}
                        <code>{GDOCS_CLIENT_EMAIL}</code> as an editor, or
                        create a Google Doc from one of the templates below:
                    </p>
                    <ul>
                        <li>
                            <a
                                href={makeGdocDuplicationUrl(
                                    GDOCS_ARTICLE_DUPLICATION_TEMPLATE_ID
                                )}
                                target="_blank"
                                rel="noopener"
                            >
                                Article
                            </a>
                        </li>
                        <li>
                            <a
                                href={makeGdocDuplicationUrl(
                                    GDOCS_DATA_INSIGHT_DUPLICATION_TEMPLATE_ID
                                )}
                                target="_blank"
                                rel="noopener"
                            >
                                Data Insight
                            </a>
                        </li>
                        <li>
                            <a
                                href={makeGdocDuplicationUrl(
                                    GDOCS_ANNOUNCEMENT_DUPLICATION_TEMPLATE_ID
                                )}
                                target="_blank"
                                rel="noopener"
                            >
                                Announcement
                            </a>
                        </li>
                    </ul>
                    Paste the URL of your new document in the field below 👇
                </div>
                <div className="form-group">
                    <input
                        type="text"
                        className="form-control"
                        onChange={(e) => setDocumentUrl(e.target.value)}
                        value={documentUrl}
                        required
                        placeholder={GDOCS_URL_PLACEHOLDER}
                        pattern={gdocUrlRegex.source}
                    />
                    <span className="validation-notice">
                        Invalid URL - it should look like this:{" "}
                        <pre>{GDOCS_URL_PLACEHOLDER}</pre>
                    </span>
                </div>
            </div>
            <div className="modal-footer">
                <button type="submit" className="btn btn-primary">
                    Add document
                </button>
            </div>
        </form>
    )
}

function makeGdocDuplicationUrl(docId: string): string {
    return `https://docs.google.com/document/d/${docId}/copy?copyCollaborators=true`
}
