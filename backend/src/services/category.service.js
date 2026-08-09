import CATEGORY_LEVEL from "../constants/category-level.js";
import Category, {
  canonicalizeCategoryDisplayName,
  normalizeCategoryName,
} from "../models/category.model.js";
import AppError from "../utils/app-error.js";

const toPublicCategory = (category) => {
  return {
    id: category._id.toString(),
    name: category.name,
    normalizedName: category.normalizedName,
    level: category.level,
    parentCategoryId:
      category.parentCategoryId == null
        ? null
        : category.parentCategoryId.toString(),
  };
};

const createFieldCategory = async ({ name }) => {
  const displayName = canonicalizeCategoryDisplayName(name);

  if (displayName === "") {
    throw new AppError(400, "Category name is required", {
      field: "name",
    });
  }

  const normalizedName = normalizeCategoryName(displayName);

  const existingField = await Category.findOne({
    parentCategoryId: null,
    normalizedName,
  }).select("_id");

  if (existingField) {
    throw new AppError(409, "FIELD category already exists", {
      field: "name",
    });
  }

  let category;

  try {
    category = await Category.create({
      name: displayName,
      level: CATEGORY_LEVEL.FIELD,
      parentCategoryId: null,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(409, "FIELD category already exists", {
        field: "name",
      });
    }

    throw error;
  }

  return toPublicCategory(category);
};

export { createFieldCategory, toPublicCategory };
