#!/usr/bin/env node

import { createRequire } from 'node:module'

import { main } from './app/cli.js'

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }

main(version)
