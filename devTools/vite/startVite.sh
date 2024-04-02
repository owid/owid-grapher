#! /bin/bash

if [ "$VITE_PREVIEW" = "true" ]; then
    echo "Starting Vite build for preview mode"
    yarn buildVite
else
    echo "Starting Vite in dev mode"
    yarn vite dev --config vite.config-site.mts
fi
