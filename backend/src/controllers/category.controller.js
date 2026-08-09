import { createFieldCategory } from "../services/category.service.js";

const createFieldCategoryHandler = async (request, response, next) => {
  try {
    const category = await createFieldCategory({
      name: request.body.name,
    });

    return response.status(201).json({
      message: "FIELD category created.",
      category,
    });
  } catch (error) {
    return next(error);
  }
};

export { createFieldCategoryHandler };
