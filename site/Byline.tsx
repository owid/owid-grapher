import React from "react"
import { formatAuthors } from "./formatting.js"

export const Byline = ({
    authors,
    withMax,
    override,
}: {
    authors: string[]
    withMax: boolean
    override?: string
}) => {
    return (
        <div className="authors-byline">
            {override ? (
                <div
                    dangerouslySetInnerHTML={{
                        __html: override,
                    }}
                ></div>
            ) : (
                <a href="/team">{`by ${formatAuthors(authors, withMax)}`}</a>
            )}
        </div>
    )
}
