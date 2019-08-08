import ReadingContext from "./ReadingContext/ReadingContext";
const { registerPlugin } = wp.plugins;
const { PluginSidebar, PluginSidebarMoreMenuItem } = wp.editPost;

const READING_CONTEXT_META_FIELD = "owid_reading_context_meta_field";
const ICON = "screenoptions";
const TITLE = "Reading context";

registerPlugin("owid-reading-context", {
  icon: ICON,
  render: () => (
    <>
      <PluginSidebarMoreMenuItem target="owid-reading-context">{TITLE}</PluginSidebarMoreMenuItem>
      <PluginSidebar name="owid-reading-context" icon={ICON} title={TITLE}>
        <div className="owid-reading-context-content">
          <ReadingContext fieldName="owid_reading_context_meta_field" />
        </div>
      </PluginSidebar>
    </>
  )
});
