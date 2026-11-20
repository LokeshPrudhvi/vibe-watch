// Metro config: the app also bundles ../shared (TMDB client, recommender, taste rules),
// which the web app uses too. shared/ has no npm dependencies of its own.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const shared = path.resolve(__dirname, "../shared");

config.watchFolders = [...(config.watchFolders ?? []), shared];
// If shared/ ever imports a package, resolve it from this app, never from the web app's node_modules
// (two copies of React would crash the app).
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
// Tests live next to the shared code; keep them out of the bundle.
config.resolver.blockList = [/shared[\\/].*\.test\.ts$/];

module.exports = config;
