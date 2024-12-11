# Site

Page templating and React components to render all of our pages on ourworldindata.org.

In brief, the WordPress rendering is based around parsing, enhancing, and hydrating the HTML output of WordPress using cheerio (jQuery for node.js) and React.

## CSS guidelines

1. Our main utility classes are in `typography.scss`, `colors.scss`, `mixins.scss`, `variables.scss`, and `grid.scss`. They're all quite short files so it's worth just scrolling through them to get a sense of what they should be used for.
2. There are also some reusable components shared between the site and grapher in `packages/@ourworldindata/components`
3. For new components, it's generally recommended to create a new file in the same directory as the component (or put it in another related file if it's small)
4. We generally follow [BEM](https://getbem.com/) for class naming (but don't use Sass's `&__block-name` feature, as that hurts greppability)
5. For responsive styles, we don't have a hard rule on whether or not you should write mobile first and then use media queries to style desktop, or the other way around.

## Google Docs

We are currently switching to ArchieML and Google Docs (usually referred to as `Gdocs` in the codebase) to more conveniently match the writing preferences of our authors. This is a work in progress and not all features supported by WordPress are in place yet.

[Reference document showing all the Archie syntax we support.](https://docs.google.com/document/d/1OLoTWloy4VecOjKTjB1wLV6tEphHJIMXfexrf1ZYJzU/edit) (Only accessible by OWID team members)

A Google Doc can be written and registered via the `/admin/gdocs` view in the admin client. One Google Doc can be registered with multiple different environments (staging, local, live, etc) so we parse and store the Google Doc content as JSON in the Grapher database of each respective environment.

This content is only updated in an environment's database when someone presses "publish" from the Google Doc preview (`/admin/gdocs/google_doc_id/preview`)

## Images

To use images locally, you need to set the `CLOUDFLARE_IMAGES_ACCOUNT_ID`,
`CLOUDFLARE_IMAGES_API_KEY`, and `CLOUDFLARE_IMAGES_URL` in your `.env` file.
See `.env.example-full` for the format.

Image blocks can be added to gdocs via the follow archie syntax:

```
{.image}
filename: my_image.png
{}
```

where `my_image.png` is an image that has been uploaded via the `/admin/images` view in the admin client, and thus exists in Cloudflare Images.

> [!CAUTION]
> Cloudflare Images don't have separate environments for production, staging and
> dev, so be careful not to upload images that are only available in one
> environment and even more **careful when deleting images**.

We store information about the image's dimensions and alt text in the database, which is shared via React context to any component that needs to render them. See `Image.tsx` for the (many) implementation details.

## Data Catalog

The data catalog is located at `/data`. You'll need to set `ALGOLIA_ID` and `ALGOLIA_SEARCH_KEY` in your .env file to run it locally. Optionally, if you want to work with a custom set of indices, you can set a `ALGOLIA_INDEX_PREFIX` which will be appended to any index you query if you use `getIndexName`. This will generally only be useful if you're an OWID member who has access to the `ALGOLIA_SECRET_KEY` and can create new indices, or if you're running your own Algolia application.
