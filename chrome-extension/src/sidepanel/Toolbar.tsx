type PreviewToolbarProps = {
    variant: "preview"
    onRefreshContent: () => void
    onRefreshAttachments: () => void
    autoRefresh: boolean
    onToggleAutoRefresh: () => void
    contentLoading: boolean
    attachmentsLoading: boolean
}

type ComponentsToolbarProps = {
    variant: "components"
    searchQuery: string
    onSearchChange: (query: string) => void
}

type ToolbarProps = PreviewToolbarProps | ComponentsToolbarProps

export function Toolbar(props: ToolbarProps) {
    if (props.variant === "components") {
        return (
            <div className="toolbar">
                <div className="toolbar-search">
                    <input
                        type="text"
                        placeholder="Search components..."
                        value={props.searchQuery}
                        onChange={(e) => props.onSearchChange(e.target.value)}
                        className="toolbar-search-input"
                    />
                </div>
            </div>
        )
    }

    // Preview variant
    const {
        onRefreshContent,
        onRefreshAttachments,
        autoRefresh,
        onToggleAutoRefresh,
        contentLoading,
        attachmentsLoading,
    } = props

    return (
        <div className="toolbar">
            <div className="toolbar-left">
                <button
                    onClick={onRefreshContent}
                    disabled={contentLoading}
                    className="toolbar-button"
                    title="Refresh content"
                >
                    {contentLoading ? "..." : "Refresh"}
                </button>
                <button
                    onClick={onRefreshAttachments}
                    disabled={attachmentsLoading}
                    className="toolbar-button toolbar-button-secondary"
                    title="Refresh attachments (charts, images, etc.)"
                >
                    {attachmentsLoading ? "..." : "Attachments"}
                </button>
            </div>
            <div className="toolbar-right">
                <label className="auto-refresh-toggle">
                    <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={onToggleAutoRefresh}
                    />
                    <span>Auto</span>
                </label>
            </div>
        </div>
    )
}
