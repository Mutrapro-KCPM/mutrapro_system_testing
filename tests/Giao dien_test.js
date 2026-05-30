Feature('Kiểm tra giao diện MuTraPro');

Scenario('Xem trang chủ và bấm thử nút Đăng Nhập', ({ I }) => {
  // Đi tới trang chủ (nó tự hiểu là http://localhost:3000/)
  I.amOnPage('/'); 

  // Kiểm tra xem trên màn hình có chữ "MuTraPro" không
  I.see('MuTraPro'); 

  // Kiểm tra câu slogan xem hiển thị đúng không
  I.see('Designed For Music, Engineered to Last');

  // Click vào cái nút "Đăng Nhập" màu xanh dương trên thanh điều hướng
  I.click('Đăng Nhập');

  // Bắt trình duyệt đợi 2 giây để ní kịp nhìn thấy nó chuyển trang
  I.wait(2); 
});