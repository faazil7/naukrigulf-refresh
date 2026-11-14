# Naukri Gulf Profile Auto-Refresh Bot 🚀

An automated Playwright-based bot that keeps your **Naukri Gulf** profile fresh and active. By updating your CV headline periodically, it updates your **"Last Updated"** timestamp so your profile stays at the top of recruiter search results.

---

## Features

- 🔐 **Persistent Browser Sessions**: Log in once interactively via the login popup (handles 2FA/OTP/Captcha seamlessly); session state is saved locally in `.naukrigulf-session`.
- 🔄 **Smart CV Headline Refresh**: Automatically toggles the trailing period on your CV headline to trigger a profile timestamp bump without altering your content.
- ⏱️ **Scheduled Execution**: Run automatically on a customizable interval (e.g., every 120 minutes).
- 👁️ **Headless & Headed Modes**: Run silently in the background or pass `--headed` to observe browser automation.

---

## Quick Start Guide

### 1. Initial Login Setup (One-Time)

Run the login command to open Chromium, click the login popup, and complete your authentication and 2FA:

```cmd
cmd /c npm run gulf:login
```

Once logged in and redirected to your dashboard, close the browser window. Your session cookies and tokens are safely stored in `.naukrigulf-session`.

### 2. Verify Session Status

Check if your saved session is active:

```cmd
cmd /c npm run gulf:status
```

### 3. Run a One-Time Profile Refresh

Execute a manual profile update:

```cmd
cmd /c npm run gulf:refresh
```
*(Pass `--headed` to watch the browser actions live)*:
```cmd
cmd /c npm run gulf:refresh -- --headed
```

### 4. Start Automated Background Refresher

Keep the bot running continuously in the background (default interval: 120 minutes):

```cmd
cmd /c npm run gulf:schedule
```
Or customize the interval:
```cmd
cmd /c npm run gulf:schedule -- --interval 60
```

---

## Project Structure

```text
├── config-gulf.js       # Configuration & URL settings for Naukri Gulf
├── naukri-gulf.js       # Playwright automation core engine
├── index-gulf.js        # CLI runner & scheduler
├── package.json         # NPM scripts and dependencies
└── .naukrigulf-session/ # Local persistent browser session storage
```
