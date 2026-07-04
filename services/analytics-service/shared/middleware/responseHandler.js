const responseHandler = (req, res, next) => {
  res.success = ({ message = 'Success', data = null, statusCode = 200 } = {}) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  };

  next();
};

module.exports = { responseHandler };
