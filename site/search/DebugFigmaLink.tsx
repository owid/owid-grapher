import { AsDraft } from "../AsDraft/AsDraft.js"
import { useSearchContext } from "./SearchContext.js"

export const DebugFigmaLink = ({ figmaNodeId }: { figmaNodeId: string }) => {
    const { templateConfig } = useSearchContext()
    return (
        <AsDraft
            className="col-start-2 span-cols-12"
            name="Template config & Figma link"
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.5rem 1rem",
                    fontSize: "0.875rem",
                }}
            >
                <span>
                    {templateConfig.resultType} | {templateConfig.topicType} |
                    Country: {templateConfig.hasCountry ? "✅" : "❌"} | Query:{" "}
                    {templateConfig.hasQuery ? "✅" : "❌"}
                </span>
                <a
                    href={`https://www.figma.com/file/lAIoPy94qgSocFKYO6HBTh/?node-id=${figmaNodeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginLeft: "auto", textDecoration: "none" }}
                >
                    🎨 Figma
                </a>
            </div>
        </AsDraft>
    )
}
