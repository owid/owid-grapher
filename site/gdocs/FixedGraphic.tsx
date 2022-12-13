import React from "react"
import ArticleBlock from "./ArticleBlock"
import { OwidArticleBlock } from "@ourworldindata/utils"

export default function FixedSection({ d }: { d: OwidArticleBlock }) {
    const position = d.value.find(
        (_d: OwidArticleBlock) => _d.type === "position"
    )
    return (
        <section className={`fixedSection ${position ? position.value : ""}`}>
            <div className={"fixedSectionGraphic"}>
                {d.value
                    .filter(
                        (_d: OwidArticleBlock) =>
                            !["text", "position"].includes(_d.type) ||
                            _d.value.startsWith("<img src=")
                    )
                    .map((_d: OwidArticleBlock, j: number) => {
                        return <ArticleBlock key={j} d={_d} />
                    })}
            </div>
            <div className={"fixedSectionContent"}>
                {d.value
                    .filter(
                        (_d: OwidArticleBlock) =>
                            _d.type === "text" &&
                            !_d.value.startsWith("<img src=")
                    )
                    .map((_d: OwidArticleBlock, j: number) => {
                        return <ArticleBlock key={j} d={_d} />
                    })}
            </div>
        </section>
    )
}
