import KeyPerformanceIndicators from "./KeyPerformanceIndicators/KeyPerformanceIndicators"
import Glossary from "./Glossary/Glossary"
import Subtitle from "./Subtitle/Subtitle"
const { registerPlugin } = wp.plugins
const { PluginDocumentSettingPanel } = wp.editPost
const { select } = wp.data

registerPlugin("owid-key-performance-indicators", {
    render: () => {
        const postType = select("core/editor").getCurrentPostType()
        return (
            postType === "page" && (
                <PluginDocumentSettingPanel
                    name="owid-key-performance-indicators"
                    title="Key Performance Indicators (KPI)"
                    className="owid-key-performance-indicators"
                >
                    <KeyPerformanceIndicators />
                </PluginDocumentSettingPanel>
            )
        )
    },
    icon: false,
})

registerPlugin("owid-glossary", {
    render: () => {
        const postType = select("core/editor").getCurrentPostType()
        return (
            (postType === "page" || postType === "post") && (
                <PluginDocumentSettingPanel
                    name="owid-glossary"
                    title="Glossary"
                    className="owid-glossary"
                >
                    <Glossary />
                </PluginDocumentSettingPanel>
            )
        )
    },
    icon: false,
})

registerPlugin("owid-subtitle", {
    render: () => {
        const postType = select("core/editor").getCurrentPostType()
        return (
            postType === "post" && (
                <PluginDocumentSettingPanel
                    name="owid-subtitle"
                    title="Subtitle"
                    className="owid-subtitle"
                >
                    <Subtitle />
                </PluginDocumentSettingPanel>
            )
        )
    },
    icon: false,
})
