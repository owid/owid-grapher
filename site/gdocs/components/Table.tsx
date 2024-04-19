import React from "react"
import { EnrichedBlockTable } from "@ourworldindata/utils"
import { ArticleBlocks } from "./ArticleBlocks.js"

function TableCell(props: {
    tag: "td" | "th"
    scope?: "row" | "col"
    children: React.ReactNode
}) {
    const { tag, scope, children } = props
    return React.createElement(tag, { scope }, children)
}

export type TableProps = {
    className?: string
} & EnrichedBlockTable

export function Table(props: TableProps) {
    const { className, rows, template } = props
    const isFirstColumnHeader =
        template === "header-column-row" || template === "header-column"
    const isFirstRowHeader =
        template === "header-column-row" || template === "header-row"

    return (
        <div className={className}>
            <table>
                {rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        {row.cells.map((cell, columnIndex) => {
                            const scope =
                                isFirstColumnHeader && columnIndex === 0
                                    ? "row"
                                    : isFirstRowHeader && rowIndex === 0
                                      ? "col"
                                      : undefined
                            const tag = scope ? "th" : "td"

                            return (
                                <TableCell
                                    key={columnIndex}
                                    scope={scope}
                                    tag={tag}
                                >
                                    <ArticleBlocks blocks={cell.content} />
                                </TableCell>
                            )
                        })}
                    </tr>
                ))}
            </table>
        </div>
    )
}
