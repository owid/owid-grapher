import { Fragment, type ReactNode } from "react"
import LinkedAuthor from "./LinkedAuthor.js"

export const Byline = ({
    names,
    authorRoles,
    prefix = "By ",
    includeImage = false,
}: {
    names: string[]
    authorRoles?: Record<string, string>
    prefix?: ReactNode
    includeImage?: boolean
}) => {
    return (
        <>
            {prefix}
            {names.map((name, index) => {
                const isLast = index === names.length - 1
                const isSecondToLast = index === names.length - 2
                return (
                    <Fragment key={name}>
                        <LinkedAuthor
                            name={name}
                            role={authorRoles?.[name]}
                            includeImage={includeImage}
                        />
                        {/* Use Oxford comma when there are more than two authors. */}
                        {!isLast && names.length > 2 && ", "}
                        {isSecondToLast && names.length > 1 && " and "}
                    </Fragment>
                )
            })}
        </>
    )
}
