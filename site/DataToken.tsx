import React from "react"

export const DataToken_name = "DataToken"

export const DataToken = ({ token, ...restProps }: { token: string }) => (
    <span>
        <script
            data-type={DataToken_name}
            type="component/props"
            data-token={token}
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(restProps),
            }}
        ></script>
    </span>
)
