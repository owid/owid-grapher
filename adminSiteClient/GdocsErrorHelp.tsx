import { Help } from "./Forms.js"
import { OwidGdocErrorMessage } from "@ourworldindata/utils"

export const GdocsErrorHelp = ({
    error,
    help,
}: {
    error?: OwidGdocErrorMessage
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
