import * as React from "react"
import * as ReactDOM from "react-dom"

const Summary = ({
    content,
    title
}: {
    content: string | null
    title: string | null
}) => {
    const CLASS_NAME = "wp-block-owid-summary"

    const onClickHandler = () => {
        console.log("hydrated")
    }
    return (
        <div className={CLASS_NAME}>
            <h2 onClick={onClickHandler}>{title}</h2>
            <div
                className="content"
                dangerouslySetInnerHTML={{ __html: content || "" }}
                onClick={onClickHandler}
            ></div>
        </div>
    )
}

export default Summary

export const hydrate = () => {
    const summaryBlock = document.querySelector(".wp-block-owid-summary")
    if (summaryBlock) {
        const blockWrapper = summaryBlock.parentElement
        const titleEl = summaryBlock.querySelector("h2")
        const title = titleEl ? titleEl.textContent : null
        const contentEl = summaryBlock.querySelector(".content")
        const content = contentEl ? contentEl.innerHTML : null
        ReactDOM.hydrate(
            <Summary content={content} title={title} />,
            blockWrapper
        )
    }
}
