#! /bin/bash

if [ "$VITE_PREVIEW" = "true" ]; then
    echo "Starting Vite build for preview mode"
    yarn vite build
else
    echo "Starting Vite in dev mode"
    yarn vite dev
fi
