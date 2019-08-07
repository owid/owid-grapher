import DeepLink from "./DeepLink/DeepLink";
const { registerPlugin } = wp.plugins;
const { PluginSidebar, PluginSidebarMoreMenuItem } = wp.editPost;

registerPlugin("owid-deep-link", {
  icon: "admin-links",
  render: () => (
    <>
      <PluginSidebarMoreMenuItem target="owid-deep-link">Deep link</PluginSidebarMoreMenuItem>
      <PluginSidebar name="owid-deep-link" icon="admin-post" title="Deep link">
        <div className="owid-deep-link-content">
          <DeepLink fieldName="owid_plugin_deep_link_meta_field" />
        </div>
      </PluginSidebar>
    </>
  )
});
