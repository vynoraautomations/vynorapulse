#!/usr/bin/env node
/**
 * Quick verification that Chrome is available
 * Run this: node verify-chrome.js
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('\n🔍 Chrome Verification\n');

// Check 1: Look for Chrome binaries
const chromePaths = [
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
];

console.log('Checking standard Chrome locations:');
let found = false;
for (const path of chromePaths) {
  const exists = fs.existsSync(path);
  console.log(`  ${exists ? '✅' : '❌'} ${path}`);
  if (exists) found = true;
}

// Check 2: Try which command
console.log('\nTrying system which command:');
try {
  const result = execSync('which chromium-browser || which chromium || which google-chrome 2>/dev/null', { encoding: 'utf8' }).trim();
  if (result) {
    console.log(`  ✅ Found: ${result}`);
    found = true;
  }
} catch (e) {
  console.log('  ❌ which command failed');
}

// Check 3: Puppeteer installation
console.log('\nChecking Puppeteer:');
try {
  const puppeteer = require('puppeteer');
  console.log('  ✅ Puppeteer installed');
} catch (e) {
  console.log('  ❌ Puppeteer not installed');
}

// Summary
console.log('\n' + '='.repeat(50));
if (found) {
  console.log('✅ Chrome is available and ready!');
  console.log('You can start the gateway with: npm start');
} else {
  console.log('❌ Chrome not found');
  console.log('On Render, ensure render.yaml has chromium-browser in buildCommand');
}
console.log('='.repeat(50) + '\n');
