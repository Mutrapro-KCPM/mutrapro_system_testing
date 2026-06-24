import path from 'path';
import { pathToFileURL } from 'url';

/** @type {CodeceptJS.MainConfig} */
export const config = {
  tests: './tests/role_workflows_test.js',
  output: './output',
  helpers: {
    Playwright: {
      browser: 'chromium',
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
      url: 'http://localhost:3000',
      show: process.env.CODECEPT_SHOW === 'true',
      slowMo: Number(process.env.CODECEPT_SLOW_MO || 0),
      windowSize: '1440x900'
    }
  },
  include: {
    I: pathToFileURL(path.resolve('./steps_file.js')).href
  },
  noGlobals: true,
  plugins: {},
  name: 'mutrapro_system_testing'
}
