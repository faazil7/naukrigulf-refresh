const path = require('path');
require('dotenv').config();

const ROOT_DIR = __dirname;
const USER_DATA_DIR = path.join(ROOT_DIR, '.naukrigulf-session');

module.exports = {
  GULF_HOME_URL: 'https://www.naukrigulf.com/',
  GULF_PROFILE_URL: 'https://www.naukrigulf.com/mnj/userProfile/myCV?source=dashboard_profile',
  USER_DATA_DIR,
  EMAIL: process.env.NAUKRI_EMAIL || '',
  PASSWORD: process.env.NAUKRI_PASSWORD || '',
  REFRESH_INTERVAL_MINUTES: parseInt(process.env.REFRESH_INTERVAL_MINUTES || '60', 10),
  HEADLESS: process.env.HEADLESS !== 'false',
};
