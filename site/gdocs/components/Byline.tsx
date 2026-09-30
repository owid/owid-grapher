import { Fragment, type ReactNode } from "react"
import { CREDITS_ID } from "@ourworldindata/utils"
import LinkedAuthor from "./LinkedAuthor.js"

export const Byline = ({
    authors,
    authorRoles,
    contributors = [],
    prefix = "By ",
}: {
    authors: string[]
    authorRoles?: Record<string, string>
    contributors?: string[]
    prefix?: ReactNode
}) => {
    const items: { key: string; node: ReactNode }[] = authors.map((name) => ({
        key: name,
        node: <LinkedAuthor name={name} role={authorRoles?.[name]} />,
    }))

    if (contributors.length > 0)
        items.push({
            key: CREDITS_ID,
            node: (
                <a href={`#${CREDITS_ID}`}>
                    {contributors.length}{" "}
                    {contributors.length === 1 ? "contributor" : "contributors"}
                </a>
            ),
        })

    return (
        <>
            {prefix}
            {items.map(({ key, node }, index) => {
                const isLast = index === items.length - 1
                const isSecondToLast = index === items.length - 2
                return (
                    <Fragment key={key}>
                        {node}
                        {/* Use Oxford comma when there are more than two items. */}
                        {!isLast && items.length > 2 && ", "}
                        {isSecondToLast && items.length > 1 && " and "}
                    </Fragment>
                )
            })}
        </>
    )
}
