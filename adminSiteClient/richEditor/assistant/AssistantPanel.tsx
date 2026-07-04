// The "Assistant" rail tab: a chat panel (pi-web-ui ChatPanel driven by a
// pi-agent-core Agent) whose tools read and edit the live collaborative
// document. Loaded lazily from RichEditorPage so the pi framework and its
// stylesheet only load when the rich editor page mounts.
//
// The stylesheet note: pi-web-ui ships Tailwind v4 CSS where everything
// lives in @layer — and unlayered author CSS (our SCSS, antd) always wins
// over layered CSS, so importing it globally on this page is safe for
// existing admin styles. Its dialogs mount on document.body (mini-lit
// DialogBase), which is why shadow-DOM scoping is not an option.

import "@earendil-works/pi-web-ui/app.css"
import { useEffect, useRef, useState } from "react"
import { Button, Space } from "antd"
import { faClockRotateLeft, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import type { AgentTool } from "@earendil-works/pi-agent-core"
import { SessionListDialog } from "@earendil-works/pi-web-ui"
import { AssistantChat } from "./agentHost.js"
import { SYSTEM_PROMPT } from "./prompts.js"

export interface AssistantPanelProps {
    gdocId: string
    docTitle: string
    /** Re-evaluated on every agent run, so it can close over live state */
    toolsFactory: () => AgentTool[]
}

export default function AssistantPanel(
    props: AssistantPanelProps
): React.ReactElement {
    const { gdocId, docTitle } = props
    const hostRef = useRef<HTMLDivElement>(null)
    const [chat, setChat] = useState<AssistantChat | null>(null)

    // the factory prop closes over changing editor state; keep the latest
    // without recreating the chat
    const toolsFactoryRef = useRef(props.toolsFactory)
    toolsFactoryRef.current = props.toolsFactory
    const docTitleRef = useRef(docTitle)
    docTitleRef.current = docTitle

    useEffect(() => {
        const instance = new AssistantChat({
            gdocId,
            get docTitle() {
                return docTitleRef.current
            },
            systemPrompt: SYSTEM_PROMPT,
            toolsFactory: () => toolsFactoryRef.current(),
        })
        hostRef.current?.appendChild(instance.element)
        void instance.start()
        setChat(instance)
        return () => {
            instance.dispose()
            instance.element.remove()
            setChat(null)
        }
    }, [gdocId])

    return (
        <div className="rich-editor-assistant">
            <div className="rich-editor-assistant__toolbar">
                <Space size="small">
                    <Button
                        size="small"
                        icon={<FontAwesomeIcon icon={faPlus} />}
                        onClick={() => void chat?.newSession()}
                    >
                        New chat
                    </Button>
                    <Button
                        size="small"
                        icon={<FontAwesomeIcon icon={faClockRotateLeft} />}
                        onClick={() =>
                            void SessionListDialog.open((sessionId) =>
                                void chat?.loadSession(sessionId)
                            )
                        }
                    >
                        History
                    </Button>
                </Space>
            </div>
            <div className="rich-editor-assistant__chat" ref={hostRef} />
        </div>
    )
}
