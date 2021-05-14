import React from "react"

export const DATA_VALUE = "DataValue"

export const DataValue = ({ value }: { value: string | number }) => (
    <span>
        {/* <script
            data-type={DataToken_name}
            type="component/props"
            data-token={token}
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(restProps),
            }}
        ></script> */}
        <span>{value}</span>
    </span>
)
