const {join} = require('path');

module.exports = {
  // Download Chrome to a persistent location
  cacheDirectory: join(__dirname, 'node_modules', '.puppeteer_browsers'),
  skipChromeDownload: false,
};
