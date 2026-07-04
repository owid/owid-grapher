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
import { useContext, useEffect, useRef, useState } from "react"
import { Button, Space } from "antd"
import { faClockRotateLeft, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Editor } from "@tiptap/core"
import { SessionListDialog } from "@earendil-works/pi-web-ui"
import { AdminAppContext } from "../../AdminAppContext.js"
import { AssistantChat } from "./agentHost.js"
import {
    createDocTools,
    describeSelection,
    type DocToolHost,
} from "./docTools.js"
import { SYSTEM_PROMPT } from "./prompts.js"
import { registerAssistantToolRenderers } from "./toolRenderers.js"

export interface AssistantPanelProps {
    gdocId: string
    docType: string
    docTitle: string
    /** The live collaborative editor; tools wait politely while it's null */
    editor: Editor | null
}

export default function AssistantPanel(
    props: AssistantPanelProps
): React.ReactElement {
    const { gdocId } = props
    const { admin } = useContext(AdminAppContext)
    const hostRef = useRef<HTMLDivElement>(null)
    const [chat, setChat] = useState<AssistantChat | null>(null)

    // tools and selection context close over live, changing state; keep the
    // latest without recreating the chat
    const propsRef = useRef(props)
    propsRef.current = props

    useEffect(() => {
        const toolHost: DocToolHost = {
            getEditor: () => propsRef.current.editor,
            getDocInfo: () => ({
                id: propsRef.current.gdocId,
                type: propsRef.current.docType,
                title: propsRef.current.docTitle,
            }),
            admin,
        }
        const instance = new AssistantChat({
            gdocId,
            get docTitle() {
                return propsRef.current.docTitle
            },
            systemPrompt: SYSTEM_PROMPT,
            toolsFactory: () => {
                const tools = createDocTools(toolHost)
                registerAssistantToolRenderers(tools)
                return tools
            },
            getSelectionContext: () => {
                const editor = propsRef.current.editor
                if (!editor) return null
                const description = describeSelection(editor)
                return description.startsWith("Nothing") ? null : description
            },
        })
        hostRef.current?.appendChild(instance.element)
        void instance.start()
        setChat(instance)
        return () => {
            instance.dispose()
            instance.element.remove()
            setChat(null)
        }
        // admin is stable for the app's lifetime
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                            void SessionListDialog.open(
                                (sessionId) => void chat?.loadSession(sessionId)
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
