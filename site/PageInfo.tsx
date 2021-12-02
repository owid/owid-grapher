import * as React from "react"

export const PageInfo = ({ info }: { info: string }) => {
    return (
        <div
            className="blog-info"
            dangerouslySetInnerHTML={{
                __html: info,
            }}
        />
    )
}
