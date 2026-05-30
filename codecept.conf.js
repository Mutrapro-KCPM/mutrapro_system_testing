import path from 'path';
import { pathToFileURL } from 'url';

/** @type {CodeceptJS.MainConfig} */
export const config = {
  tests: './tests/*_test.js',
  output: './output',
  helpers: {
    Playwright: {
      browser: 'chromium',
      url: 'http://localhost:3000',
      show: true
    }
  },
  include: {
    I: pathToFileURL(path.resolve('./steps_file.js')).href
  },
  noGlobals: true,
  plugins: {},
  name: 'mutrapro_system_testing'
}