import * as React from "react"

export const DataToken_name = "DataToken"

export const DataToken = ({ token }: { token: string }) => (
    <span>
        <script
            data-type={DataToken_name}
            type="component/props"
            data-token={token}
        ></script>
    </span>
)
