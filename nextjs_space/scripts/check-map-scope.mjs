import fs from 'node:fs'
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const dependencies = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies }
const forbidden = Object.keys(dependencies).filter(name => /google.*maps|maps.*google|@vis.gl\/react-google-maps|cesium/i.test(name))
if (forbidden.length || !dependencies.leaflet || !dependencies['react-leaflet']) {
  console.error('Map scope violation: retain Leaflet and exclude Google Maps / Cesium dependencies.'); process.exit(1)
}
console.log('Map scope passed: existing Leaflet dependencies retained.')
