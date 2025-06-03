import { categorySchema } from "../schemas/category.schema.js";

export const validateCategory = (req, res, next) => {
  try {
    categorySchema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      errors: error.errors.map((e) => ({
        field: e.path[0],
        message: e.message,
      })),
    });
  }
};
