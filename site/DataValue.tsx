import React from "react"
import { DataValueProps } from "@ourworldindata/utils"

export const DATA_VALUE = "DataValue"

export const processTemplate = (props: DataValueProps) => {
    return props.template
        .replace("%value", props.formattedValue || props.value.toString())
        .replace("%year", props.year.toString() || "")
        .replace("%unit", props.unit || "")
        .replace("%entity", props.entityName || "")
}

export const DataValue = ({ label }: { label: string }) => {
    return (
        <span
            className="data-value"
            dangerouslySetInnerHTML={{
                __html: label,
            }}
        ></span>
    )
}
