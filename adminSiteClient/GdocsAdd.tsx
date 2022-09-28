import React from "react"
import { GDOCS_CLIENT_EMAIL } from "../settings/clientSettings.js"
import { useGdocsStore } from "./GdocsStore.js"

export const GdocsAdd = ({ onAdd }: { onAdd: (id: string) => void }) => {
    const [documentUrl, setDocumentUrl] = React.useState("")
    const store = useGdocsStore()

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const regex = /https:\/\/docs\.google\.com\/document\/d\/([^\/]+)\/edit/

        const [, id] = documentUrl.match(regex) || []

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
                        <a
                            href="https://docs.google.com/document/d/1xLoZ9HBzI8PYxHpkg3PfMbz_4GasUWjllOFQLEDduEc/copy?copyCollaborators=true"
                            target="_blank"
                            rel="noopener"
                        >
                            Create a new document{" "}
                        </a>
                        from the basic article template.
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
                        placeholder="https://docs.google.com/document/d/****/edit"
                        pattern="https:\/\/docs\.google\.com\/document\/d\/([^\/]+)\/edit"
                    />
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
