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
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-http2', '--ignore-certificate-errors']
    };
    
    // In GitHub Actions, explicitly define executable path if standard detection fails
    if (process.env.GITHUB_ACTIONS) {
        // Playwright installs to a specific directory structure on Linux runners
        // We will let playwright handle the path discovery, but ensure we aren't creating 
        // persistent contexts that conflict with volatile runner environments.
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
    await page.goto(config.GULF_PROFILE_URL, { waitUntil: 'commit', timeout: 45000 });
    await page.waitForTimeout(6000);

    let refreshed = false;
    try {
      console.log('Looking for CV Headline section specifically...');
      // Target the exact section header or container for CV Headline
      const cvSection = await page.locator('div:has-text("CV headline"), section:has-text("CV headline")').last();
      let editBtn = await cvSection.locator('span:has-text("Edit"), a:has-text("Edit"), .edit, [class*="edit"]').first();

      if (await editBtn.count() > 0) {
        await editBtn.click();
        console.log('Clicked CV Headline edit button.');
        await page.waitForTimeout(2000);

        const textarea = await page.locator('textarea').first();
        if (await textarea.count() > 0) {
          let text = await textarea.inputValue();
          text = (text || '').trim();
          let actionType = text.endsWith('.') ? 'REMOVED period (.)' : 'ADDED period (.)';
          let newText = text.endsWith('.') ? text.slice(0, -1) : text + '.';
          await textarea.fill(newText);
          console.log(`\n========================================`);
          console.log(`✨ REFRESH ACTION PERFORMED: ${actionType}`);
          console.log(`📝 Updated CV Headline: "${newText}"`);
          console.log(`========================================\n`);
          await page.waitForTimeout(500);

          const saveBtn = await page.locator('button:has-text("Save"), input[value="Save"], .btn-dark-ot, button[type="submit"]').last();
          if (await saveBtn.count() > 0) {
            await saveBtn.click();
            await page.waitForTimeout(2000);
            refreshed = true;
            console.log('SUCCESS: Naukri Gulf CV Headline updated and saved successfully!');
          }
        }
      }
    } catch (err) {
      console.log('Profile refresh interaction error:', err.message);
    }

    await context.close();
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
