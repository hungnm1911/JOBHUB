import {
  createFieldCategory,
  createPositionCategory,
} from "../services/category.service.js";

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

const createPositionCategoryHandler = async (request, response, next) => {
  try {
    const category = await createPositionCategory({
      name: request.body.name,
      parentCategoryId: request.params.fieldId,
    });

    return response.status(201).json({
      message: "POSITION category created.",
      category,
    });
  } catch (error) {
    return next(error);
  }
};

export { createFieldCategoryHandler, createPositionCategoryHandler };
