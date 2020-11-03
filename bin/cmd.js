#!/usr/bin/env node
const { program } = require('commander')
const packageInfo = require('../package.json')
const startServer = require('../dist').default

program
  .version(packageInfo.version)
  .option('-p, --port <port>', 'server port. Defaults to 25.')
  .option('-c, --config <path>', 'set config path. Defaults to ./ses-credentials.json')
  .option('-x, --proxy <server>', 'set the proxy server. Defaults to https_proxy environment variable.')
  .parse(process.argv)

startServer({
  port: program.port,
  config: program.config,
  proxy: program.proxy,
})
