import mongoose from "mongoose";

import CATEGORY_LEVEL from "../constants/category-level.js";

const { Schema, model } = mongoose;

const canonicalizeCategoryDisplayName = (name) => {
  return name.trim().replace(/\s+/g, " ");
};

const normalizeCategoryName = (name) => {
  return canonicalizeCategoryDisplayName(name).toLowerCase();
};

const assertCategoryStructuralInvariants = (category) => {
  const errors = [];

  if (category.level === CATEGORY_LEVEL.FIELD) {
    if (category.parentCategoryId != null) {
      errors.push("FIELD categories must not have a parent");
    }
  }

  if (category.level === CATEGORY_LEVEL.POSITION) {
    if (category.parentCategoryId == null) {
      errors.push("POSITION categories must have a parent FIELD");
    }
  }

  return errors;
};

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      immutable: true,
      validate: {
        validator(value) {
          return typeof value === "string" && value.trim() !== "";
        },
        message: "Category name is required",
      },
    },

    normalizedName: {
      type: String,
      required: true,
      immutable: true,
    },

    level: {
      type: String,
      required: true,
      enum: Object.values(CATEGORY_LEVEL),
      immutable: true,
    },

    parentCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      immutable: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "categories",
  },
);

categorySchema.pre("validate", function deriveNormalizedNameAndInvariants() {
  if (typeof this.name === "string") {
    this.name = canonicalizeCategoryDisplayName(this.name);
    this.normalizedName = normalizeCategoryName(this.name);
  }

  const errors = assertCategoryStructuralInvariants(this);

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
});

categorySchema.index(
  { parentCategoryId: 1, normalizedName: 1 },
  { unique: true },
);

const Category = model("Category", categorySchema);

export {
  canonicalizeCategoryDisplayName,
  normalizeCategoryName,
};

export default Category;
