import { useState } from "react"
import { Button, Input, Popover, Tag } from "antd"
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"

export function CtaBlockView(props: NodeViewProps): React.ReactElement {
    const { node, updateAttributes, selected } = props
    const text = String(node.attrs.text ?? "")
    const url = String(node.attrs.url ?? "")
    const [editing, setEditing] = useState(false)

    return (
        <NodeViewWrapper
            className={`rich-cta-block${selected ? " rich-block--selected" : ""}`}
            data-drag-handle
        >
            <div className="rich-block__toolbar" contentEditable={false}>
                <Tag>cta</Tag>
                <span className="rich-block__toolbar-info">{url || "no URL set"}</span>
                <Popover
                    open={editing}
                    onOpenChange={setEditing}
                    trigger="click"
                    placement="bottom"
                    content={
                        <div className="rich-cta-block__form">
                            <label>
                                Button text
                                <Input
                                    value={text}
                                    onChange={(event) =>
                                        updateAttributes({
                                            text: event.target.value,
                                        })
                                    }
                                />
                            </label>
                            <label>
                                URL
                                <Input
                                    value={url}
                                    placeholder="https://ourworldindata.org/…"
                                    onChange={(event) =>
                                        updateAttributes({
                                            url: event.target.value,
                                        })
                                    }
                                />
                            </label>
                        </div>
                    }
                >
                    <Button size="small">Edit…</Button>
                </Popover>
            </div>
            <div className="rich-cta-block__preview" contentEditable={false}>
                <span className="rich-cta-block__button">
                    {text || "Call to action"}
                </span>
            </div>
        </NodeViewWrapper>
    )
}
