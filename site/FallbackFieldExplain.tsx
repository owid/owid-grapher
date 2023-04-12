import React from "react"
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons/faExclamationCircle"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

export const FallbackGdocFieldExplain = ({
    fieldName,
    googleDocEditLink,
    render,
    level = "info",
}: {
    fieldName: string
    googleDocEditLink: string
    render: (fallback: JSX.Element) => JSX.Element
    level?: "info" | "error"
}) => {
    const icon = level === "info" ? faExclamationCircle : faExclamationTriangle
    const styles =
        level === "info"
            ? {
                  backgroundColor: "#e6f4ff",
                  borderColor: "#91caff",
              }
            : {
                  backgroundColor: "#fffbe6",
                  borderColor: "#ffe58f",
              }

    return render(
        <div
            style={{
                backgroundColor: styles.backgroundColor,
                padding: "8px 12px",
                border: `1px solid ${styles.borderColor}`,
                borderRadius: 8,
            }}
        >
            <FontAwesomeIcon style={{ marginRight: 8 }} icon={icon} /> Edit in
            the{" "}
            <a href={googleDocEditLink} target="_blank" rel="noreferrer">
                google doc
            </a>{" "}
            by adding a "{fieldName}" heading 1
        </div>
    )
}
