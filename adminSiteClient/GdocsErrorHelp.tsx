import React from "react"
import { Help } from "./Forms.js"
import { ErrorMessage } from "./gdocsValidation.js"

export const GdocsErrorHelp = ({
    error,
    help,
}: {
    error?: ErrorMessage
    help?: string
}) => {
    return error ? (
        <div
            className={error.type}
            style={{ fontSize: "0.8em", marginTop: "0.25em" }}
        >
            {error.message}
        </div>
    ) : help ? (
        <Help>{help}</Help>
    ) : null
}
