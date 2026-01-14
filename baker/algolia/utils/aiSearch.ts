import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

interface UploadToR2Options {
    metadataPrefix?: string
}

/**
 * Upload a record to R2 as a Markdown file with base64-encoded metadata.
 * Adds a timestamp comment to force AI Search to detect content changes.
 */
export async function uploadToR2<T extends object>(
    s3Client: S3Client,
    bucket: string,
    key: string,
    markdown: string,
    metadataKey: string,
    metadata: T,
    options: UploadToR2Options = {}
): Promise<void> {
    // Add timestamp to force AI Search to detect content change and re-index
    const timestamp = new Date().toISOString()
    const markdownWithTimestamp = markdown + `\n<!-- indexed: ${timestamp} -->\n`

    // Base64 encode metadata to avoid HTTP header character issues with UTF-8
    const metadataBase64 = Buffer.from(JSON.stringify(metadata)).toString(
        "base64"
    )
    const metadataValue = options.metadataPrefix
        ? `${options.metadataPrefix}${metadataBase64}`
        : metadataBase64

    await s3Client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: markdownWithTimestamp,
            ContentType: "text/markdown",
            Metadata: {
                [metadataKey]: metadataValue,
            },
        })
    )

    console.log(`Uploaded: ${key}`)
}
