import { Tippy } from "@ourworldindata/utils"

export const Footnote = ({
    index,
    htmlContent,
    triggerTarget,
}: {
    index: number
    htmlContent?: string
    triggerTarget?: Element
}) => {
    const onEvent = (instance: any, event: Event) => {
        if (event.type === "click") event.preventDefault()
    }

    return (
        <Tippy
            appendTo={() => document.body}
            content={
                htmlContent && (
                    <div>
                        <div
                            dangerouslySetInnerHTML={{
                                __html: htmlContent,
                            }}
                        />
                    </div>
                )
            }
            interactive
            interactiveDebounce={50}
            placement="bottom"
            theme="owid-footnote"
            trigger="mouseenter focus click"
            triggerTarget={triggerTarget}
            onTrigger={onEvent}
            onUntrigger={onEvent}
        >
            <sup>{index}</sup>
        </Tippy>
    )
}
