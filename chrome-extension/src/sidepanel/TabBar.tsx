export type TabType = "preview" | "components"

interface TabBarProps {
    activeTab: TabType
    onTabChange: (tab: TabType) => void
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
    return (
        <div className="tab-bar">
            <button
                className={`tab-button ${activeTab === "preview" ? "tab-button--active" : ""}`}
                onClick={() => onTabChange("preview")}
            >
                Preview
            </button>
            <button
                className={`tab-button ${activeTab === "components" ? "tab-button--active" : ""}`}
                onClick={() => onTabChange("components")}
            >
                Components
            </button>
        </div>
    )
}
