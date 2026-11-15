const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const config = require('./config-gulf');

async function launchBrowser(options = {}) {
  const isHeadless = options.headless !== undefined ? options.headless : config.HEADLESS;

  if (!fs.existsSync(config.USER_DATA_DIR)) {
    fs.mkdirSync(config.USER_DATA_DIR, { recursive: true });
  }

    // Force use of a known browser path if environment variable is set
    const launchOptions = {
        headless: isHeadless,
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-http2', '--ignore-certificate-errors'],
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined
    };
    
    // In GitHub Actions, explicitly define executable path if standard detection fails
    if (process.env.GITHUB_ACTIONS) {
        // Based on logs, the browser is at: /home/runner/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome
        // The previous error showed a path that looked like /chrome-linux/chrome
        // Let's use a dynamic search to find the correct path
        const baseDir = '/home/runner/.cache/ms-playwright/chromium-1255/chrome-linux64/';
        if (fs.existsSync(baseDir + 'chrome')) {
            launchOptions.executablePath = baseDir + 'chrome';
        }
    }

    const context = await chromium.launchPersistentContext(config.USER_DATA_DIR, launchOptions);

  return context;
}

async function setupLogin() {
  console.log('Launching browser for Naukri Gulf login setup...');
  const context = await launchBrowser({ headless: false });
  const page = context.pages()[0] || await context.newPage();

  await page.goto(config.GULF_HOME_URL, { waitUntil: 'domcontentloaded' });
  console.log('Opened Naukri Gulf homepage.');

  // Click login button to open popup
  try {
    const loginBtn = await page.locator('#login_Layer, a:has-text("Login"), button:has-text("Login")').first();
    if (await loginBtn.count() > 0) {
      await loginBtn.click();
      console.log('Clicked login to open popup modal.');
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.log('Could not automatically click login button. Please click it manually if needed.');
  }

  if (config.EMAIL && config.PASSWORD) {
    try {
      console.log('Attempting auto-fill of credentials in popup...');
      const emailInput = await page.waitForSelector('input[placeholder*="Email"], input[id*="username"], input[type="text"]', { timeout: 5000 });
      await emailInput.fill(config.EMAIL);
      const passInput = await page.waitForSelector('input[placeholder*="Password"], input[id*="password"], input[type="password"]', { timeout: 5000 });
      await passInput.fill(config.PASSWORD);
      console.log('Credentials entered. Please click Login or complete OTP/Captcha if prompted in the popup.');
    } catch (e) {
      console.log('Manual credential entry required in popup.');
    }
  } else {
    console.log('Please log in via the popup modal in the browser window.');
  }

  console.log('Waiting for successful login and dashboard/profile access...');
  try {
    await page.waitForURL((url) => {
      const u = url.toString();
      return u.includes('mnjuser') || u.includes('profile') || (u.includes('naukrigulf.com') && !u.includes('login'));
    }, { timeout: 180000 });
    console.log('Successfully logged in! Session saved to:', config.USER_DATA_DIR);
  } catch (err) {
    console.log('Login timeout or window closed.');
  }

  await page.waitForTimeout(3000);
  await context.close();
}

async function refreshProfile(options = {}) {
  const headless = options.headless !== undefined ? options.headless : config.HEADLESS;
  console.log(`[${new Date().toLocaleString()}] Starting Naukri Gulf Profile Refresh (Headless: ${headless})...`);

  let context;
  try {
    context = await launchBrowser({ headless });
    const page = context.pages()[0] || await context.newPage();

    console.log('Navigating directly to Naukri Gulf Profile page...');
    await page.goto(config.GULF_PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(6000);

    let currentUrl = page.url();
    console.log('Current URL after navigation:', currentUrl);

    // If redirected to login, try automated login if credentials are provided
    if (currentUrl.includes('login') || currentUrl.includes('nlogin')) {
      console.log('Detected login redirect. Attempting automated login using stored credentials...');
      if (config.EMAIL && config.PASSWORD) {
        try {
          // On Naukri Gulf, login fields might be on the login page directly or in a form
          // Let's wait for username input directly
          console.log('Waiting for email input field...');
          const emailInput = await page.waitForSelector('input[type="text"], input[type="email"], input[id*="username"], input[placeholder*="Email"]', { timeout: 10000 });
          await emailInput.fill(config.EMAIL);
          console.log('Entered email.');

          console.log('Waiting for password input field...');
          const passInput = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
          await passInput.fill(config.PASSWORD);
          console.log('Entered password.');
          
          const submitBtn = await page.locator('button[type="submit"], input[value="Login"], button:has-text("Login")').first();
          if (await submitBtn.count() > 0) {
            await submitBtn.click();
            console.log('Submitted login credentials. Waiting for navigation/login completion...');
            await page.waitForTimeout(8000);
          }
        } catch (loginErr) {
          console.log('Automated login attempt failed or requires manual intervention:', loginErr.message);
        }
      } else {
        console.log('WARNING: No NAUKRI_EMAIL and NAUKRI_PASSWORD provided in environment/config for auto-login.');
      }

      // Navigate back to profile URL after login attempt
      console.log('Navigating again to profile URL after login attempt...');
      await page.goto(config.GULF_PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(6000);
      currentUrl = page.url();
      console.log('Current URL after re-navigation:', currentUrl);
    }

    let refreshed = false;
    try {
      console.log('Searching for CV Headline / Summary container...');
      
      // Scroll to load lazy sections
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);

      // Try locating the edit button by specifically matching elements near "CV Headline"
      let editBtn = null;

      // Attempt 2: If not found, look for edit icon specifically inside sections containing CV Headline
      if (!editBtn || await editBtn.count() === 0) {
        console.log('Attempting selector-based edit button search for CV Headline...');
        editBtn = await page.locator('div:has-text("CV Headline") [class*="edit"], div:has-text("CV Headline") a:has-text("Edit"), div:has-text("CV Headline") span:has-text("Edit")').first();
      }

      if (editBtn && await editBtn.count() > 0) {
        await editBtn.click();
        console.log('Clicked edit button successfully.');
        await page.waitForTimeout(3000);

        const textarea = await page.locator('textarea, [contenteditable="true"]').first();
        if (await textarea.count() > 0) {
          let text = await textarea.inputValue().catch(() => textarea.innerText());
          text = (text || '').trim();
          let actionType = text.endsWith('.') ? 'REMOVED period (.)' : 'ADDED period (.)';
          let newText = text.endsWith('.') ? text.slice(0, -1) : text + '.';
          if (typeof textarea.fill === 'function') {
            await textarea.fill(newText);
          } else {
            await textarea.type(newText);
          }
          console.log(`\n========================================`);
          console.log(`✨ REFRESH ACTION PERFORMED: ${actionType}`);
          console.log(`📝 Updated CV Headline: "${newText}"`);
          console.log(`========================================\n`);
          await page.waitForTimeout(1000);

          const saveBtn = await page.locator('button:has-text("Save"), input[value="Save"], .btn-dark-ot, button[type="submit"], a:has-text("Save")').last();
          if (await saveBtn.count() > 0) {
            await saveBtn.click();
            await page.waitForTimeout(3000);
            refreshed = true;
            console.log('SUCCESS: Naukri Gulf profile updated and saved successfully!');
          }
        } else {
          console.log('WARNING: Edit button clicked but no textarea found.');
        }
      } else {
        console.log('WARNING: Could not find any edit button on the profile page.');
      }
    } catch (err) {
      console.log('Profile refresh interaction error:', err.message);
    }

    if (context) await context.close();
    return { success: refreshed };
  } catch (err) {
    console.error('Refresh error:', err.message);
    if (context) await context.close();
    return { success: false, error: err.message };
  }
}

async function isLoggedIn() {
      let context;
      try {
        context = await launchBrowser({ headless: false });
        const page = context.pages()[0] || await context.newPage();
        await page.goto(config.GULF_PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(4000);
        const url = page.url();
        const loggedIn = !url.includes('login') && !url.includes('nlogin') && !url.includes('404');
        await context.close();
        return loggedIn;
      } catch (e) {
        if (context) await context.close();
        return false;
      }
    }

module.exports = { setupLogin, refreshProfile, isLoggedIn };
