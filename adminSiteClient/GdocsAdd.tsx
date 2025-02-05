import { GDOCS_URL_PLACEHOLDER, gdocUrlRegex } from "@ourworldindata/utils"
import * as React from "react"
import {
    GDOCS_BASIC_ARTICLE_TEMPLATE_URL,
    GDOCS_CLIENT_EMAIL,
    GDOCS_DATA_INSIGHT_TEMPLATE_URL,
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
                <ol>
                    <li>
                        Create a new document from the{" "}
                        <a
                            href={GDOCS_BASIC_ARTICLE_TEMPLATE_URL}
                            target="_blank"
                            rel="noopener"
                        >
                            basic article template
                        </a>{" "}
                        or the{" "}
                        <a
                            href={GDOCS_DATA_INSIGHT_TEMPLATE_URL}
                            target="_blank"
                            rel="noopener"
                        >
                            data insight template
                        </a>
                        .
                        <br />
                        <em>
                            Alternatively:
                            <ul>
                                <li>
                                    wrap an existing document's content in a{" "}
                                    <code>[+body] ... []</code> tag
                                </li>
                                <li>
                                    share it with{" "}
                                    <code>{GDOCS_CLIENT_EMAIL}</code> as an
                                    editor.
                                </li>
                            </ul>
                        </em>
                    </li>
                    <li>
                        Paste the URL of your new document in the field below 👇
                    </li>
                </ol>
                <div className="form-group">
                    <input
                        type="string"
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
