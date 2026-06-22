// in this file you can append custom step methods to 'I' object
import { actor } from 'codeceptjs';

export default function() {
  return actor({
    resetSession() {
      this.amOnPage('/');
      this.executeScript(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      this.amOnPage('/');
    },

    loginAs(email, password = 'Admin@123', expectedPath = '/dashboard') {
      this.amOnPage('/login');
      this.waitForElement('.form-card input[type="email"]', 10);
      this.fillField('.form-card input[type="email"]', email);
      this.fillField('.form-card input[type="password"]', password);
      this.click('.form-card button[type="submit"]');
      this.waitInUrl(expectedPath, 15);
    }
  });
}
