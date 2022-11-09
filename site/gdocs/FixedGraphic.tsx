import React from "react"
import ArticleBlock from "./ArticleBlock"
import {
    OwidRawArticleBlock,
    RawBlockFixedGraphic,
    RawBlockPosition,
} from "@ourworldindata/utils"

export default function FixedSection({ d }: { d: RawBlockFixedGraphic }) {
    const position: RawBlockPosition | undefined = d.value.find(
        (_d) => _d.type === "position"
    ) as RawBlockPosition | undefined
    return (
        <section className={`fixedSection ${position ? position.value : ""}`}>
            <div className={"fixedSectionGraphic"}>
                {d.value
                    .filter(
                        (_d: OwidRawArticleBlock) =>
                            !["text", "position"].includes(_d.type) ||
                            (_d.type === "text" &&
                                _d.value.startsWith("<img src="))
                    )
                    .map((_d: OwidRawArticleBlock, j: number) => {
                        return <ArticleBlock key={j} b={_d} />
                    })}
            </div>
            <div className={"fixedSectionContent"}>
                {d.value
                    .filter(
                        (_d: OwidRawArticleBlock) =>
                            _d.type === "text" &&
                            !_d.value.startsWith("<img src=")
                    )
                    .map((_d: OwidRawArticleBlock, j: number) => {
                        return <ArticleBlock key={j} b={_d} />
                    })}
            </div>
        </section>
    )
}
