import { Fragment } from "react"
import LinkedAuthor from "./LinkedAuthor.js"

export const Byline = ({ names }: { names: string[] }) => {
    return (
        <>
            {"By: "}
            {names.map((name, idx) => (
                <Fragment key={name}>
                    <LinkedAuthor name={name} />
                    {idx === names.length - 1
                        ? ""
                        : idx === names.length - 2
                          ? " and "
                          : ", "}
                </Fragment>
            ))}
        </>
    )
}
