import ollama from "ollama"

import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { readFileSync } from "fs"
import { resolve } from "path"
import { createInterface } from "readline"

/*
    Ollama vision capabilities with structured outputs
    From: https://github.com/ollama/ollama-js/blob/main/examples/structured_outputs/structured-outputs-image.ts
*/

const ImageDescriptionSchema = z.object({
    search_suggestions: z.array(z.string()).length(5),
})

async function run(model: string) {
    // Create readline interface for user input
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    })

    // Get path from user input
    const path = await new Promise<string>((resolve) => {
        rl.question("Enter the path to your image: ", resolve)
    })
    rl.close()

    // Verify the file exists and read it
    try {
        const imagePath = resolve(path)
        const imageBuffer = readFileSync(imagePath)
        const base64Image = imageBuffer.toString("base64")

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
        try {
            const imageAnalysis = ImageDescriptionSchema.parse(
                JSON.parse(response.message.content)
            )
            console.log("Image Analysis:", imageAnalysis)
        } catch (error) {
            console.error("Generated invalid response:", error)
        }
    } catch (error) {
        console.error("Error reading image file:", error)
    }
}

run("llama3.2-vision").catch(console.error)
