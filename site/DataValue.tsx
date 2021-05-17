import React from "react"

export const DATA_VALUE = "DataValue"

interface DataValueProps {
    value: string
    year?: string
    unit?: string
    entity?: string
    template?: string
}

const processTemplate = (props: DataValueProps) => {
    return props.template
        ?.replace("%value", props.value)
        .replace("%year", props.year || "")
        .replace("%unit", props.unit || "")
        .replace("%entity", props.entity || "")
}

export const DataValue = ({
    value,
    year,
    unit,
    entity,
    template,
}: DataValueProps) => {
    return (
        <span>
            {/* <script
            data-type={DataToken_name}
            type="component/props"
            data-token={token}
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(restProps),
            }}
        ></script> */}
            <span className="data-value">
                {processTemplate({ template, value, year, unit, entity })}
            </span>
        </span>
    )
}
