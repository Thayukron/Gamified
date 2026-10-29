const path = require('node:path')

module.exports = {
  apps: [{
    name: 'arcana',
    cwd: __dirname,
    script: '.output/server/index.mjs',
    interpreter: process.execPath,
    node_args: ['--env-file=' + path.join(__dirname, '.env')],
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production' },
  }],
}
