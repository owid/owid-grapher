import React from "react"
import ArticleBlock from "./ArticleBlock"
import {
    OwidArticleBlock,
    BlockFixedGraphic,
    BlockPosition,
} from "@ourworldindata/utils"

export default function FixedSection({ d }: { d: BlockFixedGraphic }) {
    const position: BlockPosition | undefined = d.value.find(
        (_d) => _d.type === "position"
    ) as BlockPosition | undefined
    return (
        <section className={`fixedSection ${position ? position.value : ""}`}>
            <div className={"fixedSectionGraphic"}>
                {d.value
                    .filter(
                        (_d: OwidArticleBlock) =>
                            !["text", "position"].includes(_d.type) ||
                            (_d.type === "text" &&
                                _d.value.startsWith("<img src="))
                    )
                    .map((_d: OwidArticleBlock, j: number) => {
                        return <ArticleBlock key={j} b={_d} />
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
                        return <ArticleBlock key={j} b={_d} />
                    })}
            </div>
        </section>
    )
}
