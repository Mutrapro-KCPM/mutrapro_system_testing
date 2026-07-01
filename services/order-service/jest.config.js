module.exports = {
  // Chỉ định file setup chạy trước mọi bộ test
  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.js'],
  // Nhận diện file test có định dạng .test.js
  testMatch: ['**/tests/unit/**/*.test.js'],
  // Bỏ qua file setup khỏi việc tìm kiếm test
  testPathIgnorePatterns: ['/node_modules/', '/tests/unit/setup.js']
};
