import React from "react"

export const DATA_VALUE = "DataValue"

export interface DataValueProps {
    value: string
    year?: string
    unit?: string
    entityName?: string
    template: string
}

const processTemplate = (props: DataValueProps) => {
    return props.template
        .replace("%value", props.value)
        .replace("%year", props.year || "")
        .replace("%unit", props.unit || "")
        .replace("%entity", props.entityName || "")
}

export const DataValue = ({
    value,
    year,
    unit,
    entityName,
    template,
}: DataValueProps) => {
    return (
        <span className="data-value">
            {processTemplate({ template, value, year, unit, entityName })}
        </span>
    )
}
