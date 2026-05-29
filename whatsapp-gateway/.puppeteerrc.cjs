/**
 * Puppeteer configuration for Render.com
 * Uses system chromium-browser instead of downloading
 */

module.exports = {
  // Skip Chromium download - we install via apt-get
  skipDownload: true,
  skipChromeDownload: true,
  
  // Use system chromium-browser installation
  executablePath: '/usr/bin/chromium-browser',
  
  // Cache directory if needed
  cacheDirectory: '/opt/render/.cache/puppeteer',
  
  // Additional options
  chromePath: '/usr/bin/chromium-browser',
};
