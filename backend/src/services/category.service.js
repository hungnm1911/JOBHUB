import mongoose from "mongoose";

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

const resolveCategoryDisplayName = (name) => {
  const displayName = canonicalizeCategoryDisplayName(name);

  if (displayName === "") {
    throw new AppError(400, "Category name is required", {
      field: "name",
    });
  }

  return displayName;
};

const createFieldCategory = async ({ name }) => {
  const displayName = resolveCategoryDisplayName(name);
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

const createPositionCategory = async ({ name, parentCategoryId }) => {
  if (!mongoose.Types.ObjectId.isValid(parentCategoryId)) {
    throw new AppError(400, "Invalid parent FIELD id", {
      field: "fieldId",
    });
  }

  const displayName = resolveCategoryDisplayName(name);
  const normalizedName = normalizeCategoryName(displayName);

  const parentField = await Category.findById(parentCategoryId).select(
    "_id level",
  );

  if (!parentField) {
    throw new AppError(404, "Parent FIELD category not found", {
      field: "fieldId",
    });
  }

  if (parentField.level !== CATEGORY_LEVEL.FIELD) {
    throw new AppError(409, "Parent category must be a FIELD", {
      field: "fieldId",
    });
  }

  const existingPosition = await Category.findOne({
    parentCategoryId: parentField._id,
    normalizedName,
  }).select("_id");

  if (existingPosition) {
    throw new AppError(
      409,
      "POSITION category already exists in this FIELD",
      {
        field: "name",
      },
    );
  }

  let category;

  try {
    category = await Category.create({
      name: displayName,
      level: CATEGORY_LEVEL.POSITION,
      parentCategoryId: parentField._id,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(
        409,
        "POSITION category already exists in this FIELD",
        {
          field: "name",
        },
      );
    }

    throw error;
  }

  return toPublicCategory(category);
};

export { createFieldCategory, createPositionCategory, toPublicCategory };
