# GitCMS

Some author editable content that doesn't benefit much from SQL storage can be stored in the Git content repo.

`server.ts` adds some routes to our API for writing, reading, and deleting files in the "GitCMS". The writes and deletes are committed and pushed.

`client.ts` contains methods for the browser to call these API routes.
