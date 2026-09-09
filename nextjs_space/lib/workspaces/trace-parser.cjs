// Forked parsers are outside Next's ordinary import graph. Include their full
// installed runtime dependency closure, including native/worker/font assets.
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

function parserFiles(root) {
  const seen = new Set()
  function visit(name, parent, optional = false) {
    const resolve = createRequire(path.join(parent, 'package.json'))
    let manifest
    try {
      try { manifest = resolve.resolve(`${name}/package.json`) }
      catch {
        let directory = path.dirname(resolve.resolve(name))
        while (true) {
          const candidate = path.join(directory, 'package.json')
          if (fs.existsSync(candidate) && JSON.parse(fs.readFileSync(candidate, 'utf8')).name === name) { manifest = candidate; break }
          const next = path.dirname(directory)
          if (next === directory) throw new Error(`Cannot locate parser package ${name}`)
          directory = next
        }
      }
    } catch (error) { if (optional) return; throw error }
    const directory = path.dirname(manifest)
    if (seen.has(directory)) return
    seen.add(directory)
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
    for (const dependency of Object.keys(pkg.dependencies || {})) visit(dependency, directory, !!pkg.optionalDependencies?.[dependency])
    for (const dependency of Object.keys(pkg.optionalDependencies || {})) visit(dependency, directory, true)
  }
  for (const name of ['pdfjs-dist', 'mailparser', 'mammoth']) visit(name, root)
  return [...seen].map(directory => `${path.relative(root, directory).split(path.sep).join('/')}/**/*`)
}
module.exports = { parserFiles }
