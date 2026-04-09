import { Fragment } from "react"
import LinkedAuthor from "./LinkedAuthor.js"

export const Byline = ({
    names,
    authorRoles,
}: {
    names: string[]
    authorRoles?: Record<string, string>
}) => {
    return (
        <>
            {"By "}
            {names.map((name, index) => {
                const isLast = index === names.length - 1
                const isSecondToLast = index === names.length - 2
                return (
                    <Fragment key={name}>
                        <LinkedAuthor name={name} role={authorRoles?.[name]} />
                        {/* Use Oxford comma when there are more than two authors. */}
                        {!isLast && names.length > 2 && ", "}
                        {isSecondToLast && names.length > 1 && " and "}
                    </Fragment>
                )
            })}
        </>
    )
}
