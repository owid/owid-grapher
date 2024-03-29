import KeyPerformanceIndicators from "./KeyPerformanceIndicators/KeyPerformanceIndicators.js"
import PublicationContext from "./PublicationContext/PublicationContext.js"
const { registerPlugin } = wp.plugins
const { PluginDocumentSettingPanel } = wp.editPost
const { select } = wp.data
import { Notice } from "@wordpress/components"

const OWID_KEY_PERFORMANCE_INDICATORS = "owid-key-performance-indicators"
const OWID_PUBLICATION_CONTEXT = "owid-publication-context"

registerPlugin(OWID_KEY_PERFORMANCE_INDICATORS, {
    render: () => {
        const postType = select("core/editor").getCurrentPostType()
        return (
            postType === "page" && (
                <PluginDocumentSettingPanel
                    name={OWID_KEY_PERFORMANCE_INDICATORS}
                    title="Key Performance Indicators (KPI)"
                    className={OWID_KEY_PERFORMANCE_INDICATORS}
                >
                    <KeyPerformanceIndicators />
                </PluginDocumentSettingPanel>
            )
        )
    },
    icon: false,
})

registerPlugin(OWID_PUBLICATION_CONTEXT, {
    render: () => {
        const postType = select("core/editor").getCurrentPostType()
        return (
            postType === "post" && (
                <PluginDocumentSettingPanel
                    name={OWID_PUBLICATION_CONTEXT}
                    title="Publication context"
                    className={OWID_PUBLICATION_CONTEXT}
                >
                    <Notice isDismissible={false}>
                        Currently, publication on the homepage, blog and
                        immediate newsletter cannot be dissociated from each
                        other.
                    </Notice>
                    <PublicationContext />
                </PluginDocumentSettingPanel>
            )
        )
    },
    icon: false,
})
