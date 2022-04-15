import React from "react"
import { dictionary } from "./runDataTokens.js"

export const DataToken_name = "DataToken"

export const DataToken = ({ token, ...restProps }: { token: string }) =>
    dictionary[token].wrapper(
        <script
            data-type={DataToken_name}
            type="component/props"
            data-token={token}
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(restProps),
            }}
        ></script>
    )
