import mongoose from "mongoose";

import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";

const { Schema, model } = mongoose;

const assertCompanyMemberInvariants = (member) => {
  const errors = [];

  if (member.role === COMPANY_MEMBER_ROLE.RECRUITER) {
    if (
      typeof member.employeeCode !== "string" ||
      member.employeeCode.trim() === ""
    ) {
      errors.push("employeeCode is required for RECRUITER membership");
    }

    if (
      typeof member.jobTitle !== "string" ||
      member.jobTitle.trim() === ""
    ) {
      errors.push("jobTitle is required for RECRUITER membership");
    }
  }

  if (
    member.role === COMPANY_MEMBER_ROLE.COMPANY_MANAGER &&
    member.status !== COMPANY_MEMBER_STATUS.ACTIVE
  ) {
    errors.push(
      "COMPANY_MANAGER membership status must be ACTIVE in V3",
    );
  }

  return errors;
};

const companyMemberSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      immutable: true,
    },

    role: {
      type: String,
      required: true,
      enum: Object.values(COMPANY_MEMBER_ROLE),
      immutable: true,
    },

    status: {
      type: String,
      required: true,
      enum: Object.values(COMPANY_MEMBER_STATUS),
      default: COMPANY_MEMBER_STATUS.ACTIVE,
    },

    employeeCode: {
      type: String,
      trim: true,
      default: null,
    },

    jobTitle: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

companyMemberSchema.pre("validate", function validateCompanyMember() {
  const errors = assertCompanyMemberInvariants(this);

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
});

companyMemberSchema.index({ userId: 1 }, { unique: true });
companyMemberSchema.index(
  { companyId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    },
  },
);
companyMemberSchema.index(
  { companyId: 1, employeeCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: COMPANY_MEMBER_ROLE.RECRUITER,
      employeeCode: { $type: "string" },
    },
  },
);
companyMemberSchema.index({ companyId: 1, role: 1, status: 1 });

const CompanyMember = model("CompanyMember", companyMemberSchema);

export default CompanyMember;
