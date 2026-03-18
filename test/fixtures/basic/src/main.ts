import path from 'node:path'
import ts from 'typescript'

import { App } from './app.js'
import { loadWidget } from './widget-loader.js'

console.log(path.sep, ts.version, App, loadWidget)
