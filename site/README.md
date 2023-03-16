# Site

Page templating and React components to render all of our pages on ourworldindata.org.

In brief, the WordPress rendering is based around parsing, enhancing, and hydrating the HTML output of WordPress using cheerio (jQuery for node.js) and React.

We are currently switching to ArchieML and Google Docs (usually referred to as `Gdocs` in the codebase) to more conveniently match the writing preferences of our authors. This is a work in progress and not all features supported by WordPress are in place yet.

[Reference document showing all the Archie syntax we support.](https://docs.google.com/document/d/1OLoTWloy4VecOjKTjB1wLV6tEphHJIMXfexrf1ZYJzU/edit)

A Google Doc can be written and registered via the `/admin/gdocs` view in the admin client. One Google Doc can be registered with multiple different environments (staging, local, live, etc) so we parse and store the Google Doc content as JSON in the Grapher database of each respective environment.

This content is only updated in an environment's database when someone presses "publish" from the Google Doc preview (`/admin/gdocs/google_doc_id/preview`)

## Images in Google Docs

To match Google Docs' "one document, many environments" paradigm, the source of images for all environments is a Shared Drive. An image is referenced, in Archie, via filename, which we use to find the entity via Google Drive's API.

e.g.

```
{.image}
filename: my_image.png
{}
```

This means that the filenames of images uploaded to the Shared Drive **must be unique**.

We chose to do it this way instead of via Google Drive File ID because it's easier to read and sanity check. We also considered inline images, but Google Docs doesn't support inline SVGs and downsizes images wider than 1600px.

We mirror these images to a Digital Ocean space (henceforth S3) to allow environments to have some amount of independence from one another. For OWID developers, the env variables needed for this functionality are stored in our password manager.

It is recommended to use a unique folder in S3 for each environment. By convention, `dev-name` for your local development server, and one for your staging server too (e.g. `neurath`).

### Baking images

During the baking process (`bakeDriveImages`) we:

1. Find the filenames of all the images that are currently referenced in published Google documents (the `posts_gdocs_x_images` table stores this data)
2. See if we've already uploaded them to S3 (by checking the `images` table, which is only updated after we've successfully mirrored the image to S3)
3. Mirror them to S3 if not
4. Pull all the images from S3
5. Create optimized WEBP versions of each image at multiple resolutions
6. Save them, and the original file, into the assets folder

### Previewing images

The preview flow is slightly different. If a document with an image in it is previewed, we also fetch the image from the Shared Drive and upload it to S3, but we don't do the resizing - we just display the source image via S3's CDN. This logic is all contained in the [Image component](gdocs/Image.tsx).

### Gotchas

If an image has changed since we last uploaded it to S3 (e.g. a new version has been uploaded, or its description has changed) we'll re-upload the file to S3. This happens even if you're only previewing a document that references the image, regardless of whether or not you re-publish it.

This means that any other documents that reference the image will use the updated version during the next bake, even if they haven't been republished. This seemed preferable to tracking version state and having to manually update every article when you want to update an image.
