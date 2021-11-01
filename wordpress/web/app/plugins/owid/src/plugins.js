import KeyPerformanceIndicators from "./KeyPerformanceIndicators/KeyPerformanceIndicators"
import Glossary from "./Glossary/Glossary"
import Subtitle from "./Subtitle/Subtitle"
import Length from "./Length/Length"
const { registerPlugin } = wp.plugins
const { PluginDocumentSettingPanel } = wp.editPost
const { select } = wp.data

const OWID_KEY_PERFORMANCE_INDICATORS = "owid-key-performance-indicators"
const OWID_GLOSSARY = "owid-glossary"
const OWID_SUBTITLE = "owid-subtitle"
const OWID_LENGTH = "owid-length"

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

registerPlugin(OWID_GLOSSARY, {
    render: () => {
        const postType = select("core/editor").getCurrentPostType()
        return (
            (postType === "page" || postType === "post") && (
                <PluginDocumentSettingPanel
                    name={OWID_GLOSSARY}
                    title="Glossary"
                    className={OWID_GLOSSARY}
                >
                    <Glossary />
                </PluginDocumentSettingPanel>
            )
        )
    },
    icon: false,
})

registerPlugin(OWID_SUBTITLE, {
    render: () => {
        const postType = select("core/editor").getCurrentPostType()
        return (
            postType === "post" && (
                <PluginDocumentSettingPanel
                    name={OWID_SUBTITLE}
                    title="Subtitle"
                    className={OWID_SUBTITLE}
                >
                    <Subtitle />
                </PluginDocumentSettingPanel>
            )
        )
    },
    icon: false,
})

registerPlugin(OWID_LENGTH, {
    render: () => {
        const postType = select("core/editor").getCurrentPostType()
        return (
            postType === "post" && (
                <PluginDocumentSettingPanel
                    name={OWID_LENGTH}
                    title="Length"
                    className={OWID_LENGTH}
                >
                    <Length />
                </PluginDocumentSettingPanel>
            )
        )
    },
    icon: false,
})
