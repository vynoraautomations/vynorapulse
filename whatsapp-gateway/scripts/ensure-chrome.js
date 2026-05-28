#!/usr/bin/env node
/**
 * Ensure Chrome/Chromium is properly installed for Puppeteer.
 * This script runs before starting the WhatsApp gateway service.
 */

const fs = require('fs');
const path = require('path');

async function ensureChrome() {
  console.log('[Chrome Setup] Starting Chrome installation check...');

  try {
    // Try to require puppeteer
    const puppeteer = require('puppeteer');
    console.log('[Chrome Setup] Puppeteer module loaded');

    // Try to launch and close a browser to verify installation
    console.log('[Chrome Setup] Verifying Chrome installation...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    });

    const version = await browser.version();
    console.log(`[Chrome Setup] ✓ Chrome verified: ${version}`);
    await browser.close();
    return true;
  } catch (error) {
    console.error('[Chrome Setup] ✗ Chrome verification failed:', error.message);
    
    // If Chrome is not found, try using chrome executable if available
    console.log('[Chrome Setup] Attempting to find system Chrome...');
    const chromeExecutables = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/snap/bin/chromium',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    let foundChrome = false;
    for (const chromePath of chromeExecutables) {
      if (fs.existsSync(chromePath)) {
        console.log(`[Chrome Setup] Found system Chrome at: ${chromePath}`);
        // Update puppeteer config to use this path
        process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
        foundChrome = true;
        break;
      }
    }

    if (!foundChrome) {
      console.warn('[Chrome Setup] ⚠ System Chrome not found. Puppeteer will attempt to download one.');
      console.warn('[Chrome Setup] Note: This may fail in some environments.');
      console.warn('[Chrome Setup] Consider: npm install @sparticuz/chromium');
    }

    return false;
  }
}

// Run the check
ensureChrome()
  .then((success) => {
    if (success) {
      console.log('[Chrome Setup] Ready to start WhatsApp gateway');
      process.exit(0);
    } else {
      console.log('[Chrome Setup] Proceeding with fallback configuration');
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('[Chrome Setup] Fatal error:', error);
    process.exit(1);
  });
