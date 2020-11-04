import KeyPerformanceIndicators from "./KeyPerformanceIndicators/KeyPerformanceIndicators"
import Glossary from "./Glossary/Glossary"
const { registerPlugin } = wp.plugins
const { PluginDocumentSettingPanel } = wp.editPost

const KEY_PERFORMANCE_INDICATORS_META_FIELD =
    "owid_key_performance_indicators_meta_field"

registerPlugin("owid-key-performance-indicators", {
registerPlugin("owid-glossary", {
    render: () => (
        <PluginDocumentSettingPanel
            name="owid-glossary"
            title="Glossary"
            className="owid-glossary"
        >
            <Glossary />
        </PluginDocumentSettingPanel>
    ),
    icon: false,
})
