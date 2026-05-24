// shared/middleware/validation.js
const { body, param, validationResult } = require('express-validator');

// Middleware để kiểm tra kết quả validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      error: 'Dữ liệu không hợp lệ',
      errors: errors.array()
    });
  }
  next();
};

// Validation cho đăng ký người dùng
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Tên không được để trống')
    .isLength({ min: 2, max: 100 }).withMessage('Tên phải có từ 2-100 ký tự'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Mật khẩu không được để trống')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  validate
];

// Validation cho đăng nhập
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Mật khẩu không được để trống'),
  validate
];

// Validation cho việc tạo đơn hàng
const createOrderValidation = [
  body('customer_id').isInt({ min: 1 }).withMessage('Customer ID không hợp lệ'),
  body('service_type').isIn(['transcription', 'arrangement', 'recording']).withMessage('Loại dịch vụ không hợp lệ'),
  body('description').trim().notEmpty().withMessage('Mô tả không được để trống'),
  body('price').isFloat({ min: 0 }).withMessage('Giá tiền không hợp lệ'),
  validate
];

// Validation cho ID trong URL params (/:id)
const idParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
  validate
];

// Validation cho việc tạo task
const createTaskValidation = [
  body('order_id').isInt({ min: 1 }).withMessage('Order ID không hợp lệ'),
  body('assigned_to').isInt({ min: 1 }).withMessage('ID người được giao không hợp lệ'),
  body('specialist_role').isIn(['transcriber', 'arranger', 'artist']).withMessage('Vai trò chuyên viên không hợp lệ'),
  body('deadline').isISO8601().toDate().withMessage('Deadline không hợp lệ'),
  validate
];

// Validation cho feedback
const feedbackValidation = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating phải từ 1 đến 5'),
  body('comment').optional().trim().isLength({ max: 500 }).withMessage('Bình luận không được quá 500 ký tự'),
  validate
];

// Validation cho Admin tạo user
const adminCreateUserValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Tên không được để trống'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Mật khẩu không được để trống')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  body('role')
    .isIn(['customer', 'coordinator', 'transcriber', 'arranger', 'artist', 'studio_admin', 'admin'])
    .withMessage('Vai trò không hợp lệ'),
  validate
];

// Validation cho Admin cập nhật user
const adminUpdateUserValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Tên không được để trống'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('role')
    .isIn(['customer', 'coordinator', 'transcriber', 'arranger', 'artist', 'studio_admin', 'admin'])
    .withMessage('Vai trò không hợp lệ'),
  validate
];

// Validation cho orderId trong URL params (/:orderId)
const orderIdParamValidation = [
  param('orderId').isInt({ min: 1 }).withMessage('Order ID không hợp lệ'),
  validate
];

const fileIdParamValidation = [
  param('fileId').isInt({ min: 1 }).withMessage('File ID không hợp lệ'),
  validate
];

module.exports = {
  registerValidation,
  loginValidation,
  createOrderValidation,
  idParamValidation,
  createTaskValidation,
  feedbackValidation,
  adminCreateUserValidation,
  adminUpdateUserValidation,
  orderIdParamValidation,
  fileIdParamValidation
};