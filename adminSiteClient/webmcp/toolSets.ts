/**
 * Names of the WebMCP tool sets, in their own module so the admin-wide tools
 * can wait for a page-scoped set to register without importing that page's
 * module (which imports them back).
 */
export const ADMIN_TOOL_SET = "admin"
export const CHART_EDITOR_TOOL_SET = "chart-editor"
export const CHART_LIST_TOOL_SET = "chart-list"
