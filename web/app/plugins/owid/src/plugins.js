// import ReadingContext from "./ReadingContext/ReadingContext"; // Uncomment to reactivate ReadingContext
import KeyPerformanceIndicators from "./KeyPerformanceIndicators/KeyPerformanceIndicators";
const { registerPlugin } = wp.plugins;
const {
  // PluginSidebar, // Uncomment to reactivate ReadingContext
  // PluginSidebarMoreMenuItem, // Uncomment to reactivate ReadingContext
  PluginDocumentSettingPanel
} = wp.editPost;

const KEY_PERFORMANCE_INDICATORS_FIELD =
  "owid_key_performance_indicators_meta_field";

registerPlugin("owid-key-performance-indicators", {
  render: () => (
    <PluginDocumentSettingPanel
      name="owid-key-performance-indicators"
      title="Key Performance Indicators"
      className="owid-key-performance-indicators"
    >
      <KeyPerformanceIndicators fieldName={KEY_PERFORMANCE_INDICATORS_FIELD} />
    </PluginDocumentSettingPanel>
  ),
  icon: "palmtree"
});

// Uncomment to reactivate ReadingContext
// const READING_CONTEXT_META_FIELD = "owid_reading_context_meta_field";
// const ICON = "screenoptions";
// const TITLE = "Reading context";

// registerPlugin("owid-reading-context", {
//   icon: ICON,
//   render: () => (
//     <>
//       <PluginSidebarMoreMenuItem target="owid-reading-context">
//         {TITLE}
//       </PluginSidebarMoreMenuItem>
//       <PluginSidebar name="owid-reading-context" icon={ICON} title={TITLE}>
//         <div className="owid-reading-context-content">
//           <ReadingContext fieldName={READING_CONTEXT_META_FIELD} />
//         </div>
//       </PluginSidebar>
//     </>
//   )
// });
