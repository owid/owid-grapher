import KeyPerformanceIndicators from "./KeyPerformanceIndicators/KeyPerformanceIndicators"
const { registerPlugin } = wp.plugins
const { PluginDocumentSettingPanel } = wp.editPost

const KEY_PERFORMANCE_INDICATORS_META_FIELD =
    "owid_key_performance_indicators_meta_field"

registerPlugin("owid-key-performance-indicators", {
    render: () => (
        <PluginDocumentSettingPanel
            name="owid-key-performance-indicators"
            title="Key Performance Indicators (KPI)"
            className="owid-key-performance-indicators"
        >
            <KeyPerformanceIndicators
                fieldName={KEY_PERFORMANCE_INDICATORS_META_FIELD}
            />
        </PluginDocumentSettingPanel>
    ),
    icon: false,
})
