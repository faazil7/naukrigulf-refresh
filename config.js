const path = require('path');
require('dotenv').config();

const ROOT_DIR = __dirname;
const USER_DATA_DIR = process.env.SESSION_DIR 
  ? path.resolve(process.env.SESSION_DIR) 
  : path.join(ROOT_DIR, '.naukri-session');

module.exports = {
  NAUKRI_LOGIN_URL: 'https://www.naukrigulf.com/',
  NAUKRI_PROFILE_URL: 'https://www.naukrigulf.com/mnjuser/profile',
  USER_DATA_DIR: process.env.SESSION_DIR 
    ? path.resolve(process.env.SESSION_DIR) 
    : path.join(ROOT_DIR, '.naukrigulf-session'),
  EMAIL: process.env.NAUKRI_EMAIL || '',
  PASSWORD: process.env.NAUKRI_PASSWORD || '',
  REFRESH_INTERVAL_MINUTES: parseInt(process.env.REFRESH_INTERVAL_MINUTES || '60', 10),
  HEADLESS: process.env.HEADLESS !== 'false', // Default to true unless HEADLESS=false
};
