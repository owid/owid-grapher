import React, { useContext } from "react"
import { AdminAppContext } from "./AdminAppContext.js"

export const GdocsAdd = () => {
    const [documentTitle, setDocumentTitle] = React.useState(false)
    const [documentUrl, setDocumentUrl] = React.useState("")
    const [responseSuccess, setResponseSuccess] = React.useState(false)

    const { admin } = useContext(AdminAppContext)

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const regex = /https:\/\/docs\.google\.com\/document\/d\/([^\/]+)\/edit/

        const match = documentUrl.match(regex)

        // handled by HTML5 validation below
        if (!match) return

        const documentId = match[1]
        const json = await admin.requestJSON(
            `/api/gdocs/${documentId}`,
            {},
            "POST"
        )

        // todo: handle error
        if (!json.success) return

        setDocumentTitle(json.gdoc.content.title)
        setResponseSuccess(true)
    }
    return (
        <form className="GdocAddForm" onSubmit={onSubmit}>
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
                <input
                    type="submit"
                    className="btn btn-primary"
                    value="Add document"
                />
            </div>
            {responseSuccess && (
                <div className="alert alert-success" role="alert">
                    {`Document '${documentTitle}' added successfully!`}
                </div>
            )}
        </form>
    )
}
