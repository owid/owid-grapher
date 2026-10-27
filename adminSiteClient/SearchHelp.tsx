import * as React from "react"
import { Button, Popover } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons"

export interface SearchHelpRow {
    example: string
    meaning: React.ReactNode
}

export function SearchHelp({
    children,
}: {
    children: React.ReactNode
}): React.ReactElement {
    return (
        <Popover
            title="Search syntax"
            placement="bottomLeft"
            content={<div className="search-help">{children}</div>}
        >
            <Button
                type="text"
                aria-label="Search syntax"
                icon={<FontAwesomeIcon icon={faCircleQuestion} />}
            />
        </Popover>
    )
}

/** Example queries next to what they find */
export function SearchHelpTable({
    heading,
    rows,
}: {
    heading?: string
    rows: readonly SearchHelpRow[]
}): React.ReactElement {
    return (
        <>
            {heading && <h4 className="search-help__heading">{heading}</h4>}
            <table className="search-help__table">
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.example}>
                            <td>
                                <code>{row.example}</code>
                            </td>
                            <td>{row.meaning}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    )
}
