#!/usr/bin/env node

const gulf = require('./naukri-gulf');
const config = require('./config-gulf');

const args = process.argv.slice(2);
const command = args[0] || 'help';

async function main() {
  if (command === 'login') {
    await gulf.setupLogin();
  } else if (command === 'refresh') {
    const headed = args.includes('--headed');
    await gulf.refreshProfile({ headless: !headed });
  } else if (command === 'status') {
    const loggedIn = await gulf.isLoggedIn();
    console.log(loggedIn ? 'Status: Logged In (Session valid)' : 'Status: Not Logged In. Please run `node index-gulf.js login`.');
  } else if (command === 'schedule') {
    const intervalIdx = args.indexOf('--interval');
    const interval = intervalIdx !== -1 && args[intervalIdx + 1] ? parseInt(args[intervalIdx + 1], 10) : config.REFRESH_INTERVAL_MINUTES;
    
    console.log(`Starting Naukri Gulf automated scheduler (Interval: ${interval} minutes)...`);
    
    // Run immediately once
    await gulf.refreshProfile();

    // Schedule subsequent runs
    setInterval(async () => {
      await gulf.refreshProfile();
    }, interval * 60 * 1000);
  } else {
    console.log(`
Naukri Gulf Auto-Refresh Bot CLI
Usage:
  node index-gulf.js login      - Log into Naukri Gulf interactively (handles login popup & 2FA)
  node index-gulf.js status     - Check if saved session is active
  node index-gulf.js refresh    - Perform a one-time profile refresh (--headed to show browser)
  node index-gulf.js schedule   - Run continuous background refreshes [--interval <minutes>]
    `);
  }
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
