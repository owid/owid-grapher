## Development server

To run the local development server you need to have a [working local TypeScript environment](local-typescript-setup.md) and a [mysql grapher database](docker-compose-mysql.md) with the our world in data content loaded.

Set up your `.env` file by copying the example:

```sh
cp .env.example .env
```

Then run the three development processes:

```sh
yarn startTscServer
yarn startAdminServer
yarn startWebpackServer
```

Or alternatively, you can also start all 3 processes in one terminal window with tmux:

```sh
yarn startTmuxServer
```

Then head to `localhost:3030/admin`. If everything is going to plan, you should see a login screen! The default user account is `admin@example.com` with a password of `admin`.

This development server will rebuild the site when changes are made, so you only need to reload the browser when making changes.
