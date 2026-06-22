const runId = Date.now();
const customer = {
  name: 'cus123',
  email: 'cus123@gmail.com',
  password: '123456'
};

Feature('Kiểm tra giao diện và luồng nghiệp vụ MuTraPro');

Before(({ I }) => I.resetSession());

Scenario('1. Xem trang chủ và kiểm tra slogan', ({ I }) => {
  I.see('MuTraPro');
  I.see('Designed For Music, Engineered to Last');
});

Scenario('2. Customer tạo đơn, coordinator giao việc, transcriber bắt đầu làm', async ({ I }) => {
  I.amOnPage('/register');
  I.waitForElement('.form-card input[type="text"]', 10);
  I.fillField('.form-card input[type="text"]', customer.name);
  I.fillField('.form-card input[type="email"]', customer.email);
  I.fillField('.form-card input[type="password"]', customer.password);
  I.click('.form-card button[type="submit"]');
  I.wait(2);

  const registrationUrl = await I.grabCurrentUrl();
  if (!registrationUrl.includes('/login')) {
    I.amOnPage('/login');
  }

  I.loginAs(customer.email, customer.password, '/dashboard');
  I.see('Vai trò: customer');
  I.click('Tạo đơn hàng mới');
  I.waitInUrl('/orders/new', 10);
  I.selectOption('.form-card select', 'transcription');
  I.fillField('.form-card textarea', `Codecept transcription request ${runId}`);
  I.click('Gửi Yêu Cầu');
  I.waitInUrl('/orders/history', 15);
  I.waitForElement('.admin-table tbody tr:first-child', 10);
  const orderRef = await I.grabTextFrom('.admin-table tbody tr:first-child td:first-child a');
  const orderId = orderRef.replace('#', '').trim();

  I.resetSession();
  I.loginAs('dpv@mutrapro.com', 'Admin@123', '/dashboard');
  I.waitForText('Quản lý Toàn bộ Đơn hàng', 10);
  const orderRow = `//tr[td/a[normalize-space()='#${orderId}']]`;
  I.waitForElement(orderRow, 10);
  I.click(`${orderRow}//button[contains(., 'Giao việc')]`);
  I.waitForElement('.modal-content select', 10);
  I.click('.modal-content .form-button:not(.secondary)');
  I.waitForText(`Đã giao việc cho đơn hàng #${orderId} thành công!`, 15);

  I.resetSession();
  I.loginAs('cvka@mutrapro.com', 'Admin@123', '/dashboard');
  I.click('Vào không gian làm việc');
  I.waitInUrl('/workspace/transcriber', 10);
  I.waitForText('Việc Ký Âm Của Bạn', 10);
  const taskItem = `//div[contains(@class, 'task-list-item')][.//p[contains(., 'Đơn hàng #${orderId}')]]`;
  I.waitForElement(taskItem, 10);
  I.click(taskItem);
  I.waitForText(`Chi tiết công việc (Đơn hàng #${orderId})`, 10);
  I.click('Bắt đầu ký âm');
  I.waitForText('Đã bắt đầu công việc!', 10);
  I.waitForText('Trạng thái: in_progress', 10);
});

Scenario('3. Admin xem báo cáo Analytics', ({ I }) => {
  I.loginAs('admin@mutrapro.com', 'Admin@123', '/dashboard');
  I.see('Vai trò: admin');
  I.click('Xem Báo Cáo & Thống Kê');
  I.waitInUrl('/admin/dashboard', 10);
  I.waitForText('Báo Cáo & Thống Kê', 10);
  I.see('Tổng Doanh Thu');
  I.see('Tổng Số Đơn Hàng');
});

Scenario('4. Artist mở workspace và trang đặt lịch phòng thu', ({ I }) => {
  I.loginAs('artist@mutrapro.com', 'Admin@123', '/dashboard');
  I.see('Vai trò: artist');
  I.click('Vào không gian làm việc');
  I.waitInUrl('/workspace/artist', 10);
  I.waitForText('Việc Thu Âm Của Bạn', 10);
  I.amOnPage('/studio/booking');
  I.waitForText('Đặt Lịch Phòng Thu', 10);
});

Scenario('5. Arranger mở không gian làm việc', ({ I }) => {
  I.loginAs('cvpk@mutrapro.com', 'Admin@123', '/dashboard');
  I.see('Vai trò: arranger');
  I.click('Vào không gian làm việc');
  I.waitInUrl('/workspace/arranger', 10);
  I.waitForText('Việc Phối Khí Của Bạn', 10);
});

Scenario('6. Studio admin xem và khôi phục trạng thái phòng thu', ({ I }) => {
  I.loginAs('studio@mutrapro.com', 'Admin@123', '/admin/studios');
  I.waitForText('Bảng điều khiển Quản trị Phòng thu', 10);
  I.waitForElement('.status-select', 10);
  const firstStatus = { xpath: '(//select[contains(@class, "status-select")])[1]' };
  I.selectOption(firstStatus, 'maintenance');
  I.wait(1);
  I.selectOption(firstStatus, 'available');
  I.wait(1);
  I.see('Lịch Đặt Phòng');
});
