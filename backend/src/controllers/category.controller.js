import {
  createFieldCategory,
  createPositionCategory,
  listFieldCategories,
  listPositionCategoriesByField,
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

const listFieldCategoriesHandler = async (request, response, next) => {
  try {
    const fields = await listFieldCategories();

    return response.status(200).json({ fields });
  } catch (error) {
    return next(error);
  }
};

const listPositionCategoriesHandler = async (request, response, next) => {
  try {
    const positions = await listPositionCategoriesByField(
      request.params.fieldId,
    );

    return response.status(200).json({ positions });
  } catch (error) {
    return next(error);
  }
};

export {
  createFieldCategoryHandler,
  createPositionCategoryHandler,
  listFieldCategoriesHandler,
  listPositionCategoriesHandler,
};
