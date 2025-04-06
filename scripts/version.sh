#!/bin/sh
set -e
# shellcheck disable=SC2154
if [ "$npm_lifecycle_event" != "version" ]; then
  echo 'not executed by npm' >&2
  exit 1
fi
(cd contracts && BUMP_FROM_PROJECT_ROOT_DIRECTORY=yes npm version "$(node -pe 'require("../package.json").version')")
npm i '@local-dependencies/contracts@file:./contracts'
git add contracts/package.json
