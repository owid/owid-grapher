import React from "react"
import { ErrorMessage } from "./gdocsValidation.js"

export const GdocsErrorHelp = ({ error }: { error?: ErrorMessage }) => {
    return error ? (
        <div
            className={error.type}
            style={{ fontSize: "0.8em", marginTop: "0.25em" }}
        >
            {error.message}
        </div>
    ) : null
}
