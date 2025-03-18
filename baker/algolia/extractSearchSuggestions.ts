import ollama from "ollama"
import fetch from "node-fetch"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

/*
    Ollama vision capabilities with structured outputs
    From: https://github.com/ollama/ollama-js/blob/main/examples/structured_outputs/structured-outputs-image.ts
*/

const ImageDescriptionSchema = z.object({
    search_suggestions: z.array(z.string()).length(5),
})

/**
 * Extracts search suggestions from an image URL
 * This function only knows how to process an image URL and doesn't have any chart-specific logic
 */
export const extractSearchSuggestions = async (
    model: string,
    imageUrl: string
): Promise<string[]> => {
    try {
        // Download the image directly as a buffer
        console.log(`Downloading image from ${imageUrl}`)
        const responseImage = await fetch(imageUrl)
        if (!responseImage.ok) {
            throw new Error(
                `Failed to fetch image: ${responseImage.statusText}`
            )
        }

        // Get the image as arrayBuffer and convert to base64
        const imageBuffer = await responseImage.arrayBuffer()
        const base64Image = Buffer.from(imageBuffer).toString("base64")

        // Convert the Zod schema to JSON Schema format
        const jsonSchema = zodToJsonSchema(ImageDescriptionSchema)

        const messages = [
            {
                role: "user",
                content: `
                    Generate a JSON output containing exactly 5 search suggestions that a user might type into a search engine when looking for information related to this chart. The suggestions should be concise, natural, and reflect common online search behavior. If you cannot determine certain details leave those fields empty.`,
                images: [base64Image],
            },
        ]

        const response = await ollama.chat({
            model: model,
            messages: messages,
            format: jsonSchema,
            options: {
                temperature: 0, // Make responses more deterministic
            },
        })

        // Parse and validate the response
        const imageAnalysis = ImageDescriptionSchema.parse(
            JSON.parse(response.message.content)
        )
        return imageAnalysis.search_suggestions || []
    } catch (error) {
        console.error("Error processing image:", error)
        return []
    }
}
