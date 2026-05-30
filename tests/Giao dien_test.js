Feature('Kiểm tra toàn diện giao diện MuTraPro');

Scenario('1. Xem trang chủ và kiểm tra slogan', ({ I }) => {
  I.amOnPage('/'); 
  I.see('MuTraPro'); 
  I.see('Designed For Music, Engineered to Last');
});

Scenario('2. Tự động điền form Đăng Ký thành viên mới', ({ I }) => {
  I.amOnPage('/');
  I.click('Đăng Ký'); 
  I.wait(2); // Chờ form hiện lên hẳn

  // Định vị chính xác theo type của input nằm trong form-card
  I.fillField('.form-card input[type="text"]', 'Bét Yasuo');
  I.fillField('.form-card input[type="email"]', 'yasuo2027@gmail.com');
  I.fillField('.form-card input[type="password"]', '12345678');

  // Click đúng vào nút button có class form-button chứa chữ Đăng Ký
  I.click('.form-button'); 
  I.wait(4); // Đợi kết quả phản hồi từ auth-service
});

Scenario('3. Tự động điền form Đăng Nhập hệ thống', ({ I }) => {
  I.amOnPage('/');
  I.click('Đăng Nhập'); 
  I.wait(2); 

  // Dùng tài khoản có sẵn trong database của ní để test đăng nhập
  I.fillField('.form-card input[type="email"]', 'yasuo2027@gmail.com');
  I.fillField('.form-card input[type="password"]', '12345678');

  // Bấm nút đăng nhập (nó cũng xài chung class .form-button)
  I.click('.form-button'); 
  I.wait(4);
});