import React from "react"
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
                    <li>Make a copy of this Google Doc.</li>
                    <li>Edit the title</li>
                    <li>Add xxx@yy.iam.gserviceaccount.com as an editor</li>
                    <li>Fill in the URL of your Doc in the field below 👇</li>
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
