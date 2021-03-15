# Droplet

This folder contains the code for setting up dev staging environments.

## Monitoring the Admin Site

We use (pm2)[https://www.npmjs.com/package/pm2] for running the adminSiteServer and the deploy queue server.

Common tasks:

```bash
# See the running pm2 apps
pm2 list

# See logs of the running apps
pm2 logs

# See the last N lines in live error log
tail -200 /home/owid/.pm2/logs/live-error.log

# Restart the admin app
pm2 restart live
```
