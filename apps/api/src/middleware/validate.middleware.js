const { errors } = require('../utils/app-error');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      params: req.params,
      query: req.query,
      body: req.body
    });

    if (!result.success) {
      return next(errors.validation('Dữ liệu không hợp lệ', result.error.flatten()));
    }

    req.validated = result.data;
    return next();
  };
}

module.exports = { validate };
