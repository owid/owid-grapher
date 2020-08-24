import React from "react"
import { formatReusableBlock } from "site/server/formatting"

const ExplorerContent = ({ content }: { content: string }) => {
    return (
        <div className="explorerContentContainer">
            <div className="article-content">
                <section>
                    <div className="wp-block-columns is-style-sticky-right">
                        <div
                            className="wp-block-column"
                            dangerouslySetInnerHTML={{
                                __html: formatReusableBlock(content)
                            }}
                        ></div>
                        <div className="wp-block-column"></div>
                    </div>
                </section>
            </div>
        </div>
    )
}

export default ExplorerContent
