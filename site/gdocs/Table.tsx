import React from "react"
import { EnrichedBlockTable } from "@ourworldindata/utils"
import ArticleBlock from "./ArticleBlock.js"

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
        <table className={className}>
            {rows.map((row, i) => (
                <tr key={i} className="table-row">
                    {row.cells.map((cell, j) => {
                        if (isFirstColumnHeader && j === 0) {
                            return (
                                <th scope="col" className="table-cell" key={j}>
                                    {cell.content.map((block, k) => {
                                        return (
                                            <ArticleBlock key={k} b={block} />
                                        )
                                    })}
                                </th>
                            )
                        }
                        if (isFirstRowHeader && i === 0) {
                            return (
                                <th scope="row" className="table-cell" key={j}>
                                    {cell.content.map((block, k) => {
                                        return (
                                            <ArticleBlock key={k} b={block} />
                                        )
                                    })}
                                </th>
                            )
                        }
                        return (
                            <th className="table-cell" key={j}>
                                {cell.content.map((block, k) => {
                                    return <ArticleBlock key={k} b={block} />
                                })}
                            </th>
                        )
                    })}
                </tr>
            ))}
        </table>
    )
}
