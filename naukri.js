const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const config = require('./config');

/**
 * Launch Chromium browser with persistent context to store login state.
 */
async function launchBrowser(options = {}) {
  const isHeadless = options.headless !== undefined ? options.headless : config.HEADLESS;

  // Ensure user data directory exists
  if (!fs.existsSync(config.USER_DATA_DIR)) {
    fs.mkdirSync(config.USER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(config.USER_DATA_DIR, {
    headless: isHeadless,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  return context;
}

/**
 * Check if the browser is currently logged into Naukri.
 */
async function isLoggedIn(options = {}) {
  const headless = options.headless !== undefined ? options.headless : false;
  let context;
  try {
    context = await launchBrowser({ headless });
    const page = context.pages()[0] || await context.newPage();
    await page.goto(config.NAUKRI_PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const url = page.url();
    if (url.includes('nlogin') || (url.includes('login') && !url.includes('naukrigulf.com/'))) {
      await context.close();
      return false;
    }
    // Check for profile element or general logged-in page structure
    const profileHeader = await page.$('.profile-head, .supp-head, .title, .name-wrapper, .lazy-render, .resumeHeadline, .profileSummary, div[class*="profile"], header, nav');
    const loggedIn = !!profileHeader || !url.includes('login');
    await context.close();
    return loggedIn;
  } catch (err) {
    if (context) await context.close();
    return false;
  }
}

/**
 * Perform manual or credential-based login setup.
 */
async function setupLogin(options = {}) {
  console.log('Launching browser for Naukri login setup...');
  const context = await launchBrowser({ headless: false });
  const page = context.pages()[0] || await context.newPage();

  await page.goto(config.NAUKRI_LOGIN_URL, { waitUntil: 'domcontentloaded' });

  // Click login button/link to trigger popup if needed
  try {
    const loginTrigger = await page.locator('#login_Layer, a:has-text("Login"), button:has-text("Login")').first();
    if (await loginTrigger.count() > 0) {
      await loginTrigger.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}

  // Auto-fill if credentials provided
  if (config.EMAIL && config.PASSWORD) {
    try {
      console.log('Attempting auto-fill with configured credentials...');
      await page.waitForSelector('input[placeholder*="Email"], input[type="text"]', { timeout: 5000 });
      await page.fill('input[placeholder*="Email"], input[type="text"]', config.EMAIL);
      await page.fill('input[placeholder*="Password"], input[type="password"]', config.PASSWORD);
      console.log('Credentials entered. Please click Login or complete OTP/Captcha if prompted.');
    } catch (e) {
      console.log('Manual input required on login page.');
    }
  } else {
    console.log('Please complete the login in the opened browser window (including OTP/2FA if prompted).');
  }

  console.log('Waiting for successful login to Naukri profile page...');
  
  // Wait until navigated to profile, dashboard, or main domain logged in state
  try {
    await page.waitForURL((url) => {
      const u = url.toString();
      return u.includes('/mnjuser/profile') || u.includes('/mnjuser/homepage') || u.includes('naukrigulf.com/') && !u.includes('login');
    }, { timeout: 180000 });
    console.log('Successfully logged in! Session saved to:', config.USER_DATA_DIR);
  } catch (err) {
    console.log('Login timeout or window closed before completing profile navigation.');
  }

  await page.waitForTimeout(3000);
  await context.close();
}

/**
 * Perform profile refresh by updating Resume Headline / Profile Summary.
 */
async function refreshProfile(options = {}) {
  const headless = options.headless !== undefined ? options.headless : config.HEADLESS;
  console.log(`[${new Date().toLocaleString()}] Starting Naukri Profile Refresh (Headless: ${headless})...`);

  let context;
  try {
    context = await launchBrowser({ headless });
    const page = context.pages()[0] || await context.newPage();

    console.log('Navigating to Naukri Profile page...');
    await page.goto(config.NAUKRI_PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    // Check login status
    if (page.url().includes('login') || page.url().includes('nlogin')) {
      // If credentials are provided in env (e.g. GitHub Actions), attempt automated login
      if (config.EMAIL && config.PASSWORD) {
        console.log('Session not found or expired. Attempting automated login with credentials...');
        try {
          await page.fill('input[placeholder*="Email"], input[type="text"]', config.EMAIL);
          await page.fill('input[placeholder*="Password"], input[type="password"]', config.PASSWORD);
          const loginBtn = await page.locator('button:has-text("Login"), button[type="submit"]').first();
          if (await loginBtn.count() > 0) {
            await loginBtn.click();
            await page.waitForURL((url) => url.toString().includes('/mnjuser/profile') || url.toString().includes('/mnjuser/homepage'), { timeout: 30000 });
            await page.goto(config.NAUKRI_PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForTimeout(3000);
          }
        } catch (loginErr) {
          console.error('Automated login failed (likely blocked by Captcha/OTP):', loginErr.message);
        }
      }

      if (page.url().includes('login') || page.url().includes('nlogin')) {
        console.error('ERROR: Session expired or not logged in. Please run `npm start login` first to log in.');
        await context.close();
        return { success: false, reason: 'NOT_LOGGED_IN' };
      }
    }

    // Dismiss intrusive popups if present
    try {
      const closeButtons = await page.$$('.crossIcon, .close-icon, button:has-text("Skip"), div[class*="cross"]');
      for (const btn of closeButtons) {
        if (await btn.isVisible()) {
          await btn.click().catch(() => {});
        }
      }
    } catch (e) {}

    let refreshed = false;
    let detailMsg = '';

    // Method: Generic click on edit button or heading on Naukri Gulf profile
    console.log('Attempting to update profile on Naukri Gulf...');
    try {
      await page.waitForTimeout(2000);
      // Try to click edit icon or text on Naukri Gulf profile
      const editTrigger = await page.locator('span:has-text("Edit"), a:has-text("Edit"), .icon-edit, [class*="edit"]').first();
      if (await editTrigger.count() > 0) {
        await editTrigger.click();
        await page.waitForTimeout(2000);

        const textarea = await page.locator('textarea, input[type="text"]').first();
        if (await textarea.count() > 0) {
          let text = await textarea.inputValue();
          text = (text || '').trim();
          let newText = text.endsWith('.') ? text.slice(0, -1) : text + '.';
          await textarea.fill(newText);
          await page.waitForTimeout(500);

          const saveBtn = await page.locator('button:has-text("Save"), input[value="Save"], .btn-dark-ot').last();
          if (await saveBtn.count() > 0) {
            await saveBtn.click();
            await page.waitForTimeout(2000);
            refreshed = true;
            detailMsg = 'Naukri Gulf profile updated and saved successfully!';
            console.log(`SUCCESS: ${detailMsg}`);
          }
        }
      }
    } catch (err) {
      console.log('Naukri Gulf edit trigger failed:', err.message);
    }

    // Check last updated text on profile header
    let lastUpdatedText = 'Unknown';
    try {
      const modDateElem = await page.$('.mod-date, .last-updated, div:has-text("Profile last updated"), span:has-text("Profile last updated")');
      if (modDateElem) {
        lastUpdatedText = await modDateElem.textContent();
        lastUpdatedText = lastUpdatedText.trim();
        console.log(`Profile Status: ${lastUpdatedText}`);
      }
    } catch (e) {}

    await context.close();

    if (refreshed) {
      return {
        success: true,
        message: detailMsg,
        lastUpdated: lastUpdatedText,
        timestamp: new Date().toISOString()
      };
    } else {
      console.error('ERROR: Could not find edit triggers for profile refresh.');
      return { success: false, reason: 'EDIT_ELEMENT_NOT_FOUND' };
    }

  } catch (err) {
    console.error('Error during profile refresh:', err.message);
    if (context) await context.close();
    return { success: false, error: err.message };
  }
}

module.exports = {
  setupLogin,
  refreshProfile,
  isLoggedIn
};
