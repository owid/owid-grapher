import ReadingContext from "./ReadingContext/ReadingContext";
import KeyPerformanceIndicators from "./KeyPerformanceIndicators/KeyPerformanceIndicators";
const { registerPlugin } = wp.plugins;
const {
  PluginSidebar,
  PluginSidebarMoreMenuItem,
  PluginDocumentSettingPanel
} = wp.editPost;

const READING_CONTEXT_META_FIELD = "owid_reading_context_meta_field";
const KEY_PERFORMANCE_INDICATORS_FIELD =
  "owid_key_performance_indicators_meta_field";
const ICON = "screenoptions";
const TITLE = "Reading context";

registerPlugin("owid-reading-context", {
  icon: ICON,
  render: () => (
    <>
      <PluginSidebarMoreMenuItem target="owid-reading-context">
        {TITLE}
      </PluginSidebarMoreMenuItem>
      <PluginSidebar name="owid-reading-context" icon={ICON} title={TITLE}>
        <div className="owid-reading-context-content">
          <ReadingContext fieldName="owid_reading_context_meta_field" />
        </div>
      </PluginSidebar>
    </>
  )
});

registerPlugin("owid-key-performance-indicators", {
  render: () => (
    <PluginDocumentSettingPanel
      name="kpi"
      title="Key Performance Indicators"
      className="kpi"
    >
      <KeyPerformanceIndicators fieldName={KEY_PERFORMANCE_INDICATORS_FIELD} />
    </PluginDocumentSettingPanel>
  ),
  icon: "palmtree"
});
