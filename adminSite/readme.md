# Admin Site

This is the project that contains the express backend and React frontend for authors to create charts and perform other admin tasks. The backend also contains some development apis and tools.

## Using

`package.json` contains a one liner for starting the admin server.

## Design Notes

### Mock Site

Although we bake our site to static files and serve via a CDN, we still want a dynamic way to serve all of our routes for faster development and testing. So we have the `mockSiteRouter`, which is roughly the dynamic version of our static site.
