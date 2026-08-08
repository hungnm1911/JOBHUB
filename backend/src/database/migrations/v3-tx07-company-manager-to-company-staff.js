import mongoose from "mongoose";

import COMPANY_MEMBER_ROLE from "../../constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../constants/company-member-status.js";
import USER_ROLE from "../../constants/user-role.js";
import CompanyMember from "../../models/company-member.model.js";

const LEGACY_COMPANY_MANAGER_ROLE = "COMPANY_MANAGER";

const name = "v3-tx07-company-manager-to-company-staff";

const getCollections = (connection) => {
  const db = connection.db;

  return {
    companies: db.collection("companies"),
    companyMembers: db.collection("companymembers"),
    users: db.collection("users"),
  };
};

const migrateCompanyUnit = async ({
  company,
  companies,
  companyMembers,
  users,
  session,
}) => {
  const managerUserId = company.managerUserId;

  if (managerUserId == null) {
    return { skipped: true };
  }

  const existingMembership = await companyMembers.findOne(
    {
      companyId: company._id,
      role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    },
    { session },
  );

  if (!existingMembership) {
    await companyMembers.insertOne(
      {
        userId: managerUserId,
        companyId: company._id,
        role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
        status: COMPANY_MEMBER_STATUS.ACTIVE,
        employeeCode: null,
        jobTitle: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { session },
    );
  }

  await users.updateOne(
    {
      _id: managerUserId,
      role: LEGACY_COMPANY_MANAGER_ROLE,
    },
    {
      $set: {
        role: USER_ROLE.COMPANY_STAFF,
        updatedAt: new Date(),
      },
    },
    { session },
  );

  await companies.updateOne(
    { _id: company._id },
    {
      $unset: { managerUserId: "" },
      $set: { updatedAt: new Date() },
    },
    { session },
  );

  return { skipped: false };
};

const migrate = async (connection = mongoose.connection) => {
  if (connection.readyState !== 1) {
    throw new Error("MongoDB connection must be ready before TX-07 migration");
  }

  // Ensure Mongoose indexes exist for company_members before cutover writes.
  await CompanyMember.init();

  const { companies, companyMembers, users } = getCollections(connection);
  const legacyCompanies = await companies
    .find({ managerUserId: { $exists: true, $ne: null } })
    .toArray();

  let migratedCount = 0;
  let skippedCount = 0;

  for (const company of legacyCompanies) {
    const session = await connection.startSession();

    try {
      await session.withTransaction(async () => {
        const result = await migrateCompanyUnit({
          company,
          companies,
          companyMembers,
          users,
          session,
        });

        if (result.skipped) {
          skippedCount += 1;
        } else {
          migratedCount += 1;
        }
      });
    } finally {
      await session.endSession();
    }
  }

  await users.updateMany(
    { role: LEGACY_COMPANY_MANAGER_ROLE },
    {
      $set: {
        role: USER_ROLE.COMPANY_STAFF,
        updatedAt: new Date(),
      },
    },
  );

  return {
    migratedCount,
    skippedCount,
    name,
  };
};

const verify = async (connection = mongoose.connection) => {
  if (connection.readyState !== 1) {
    throw new Error("MongoDB connection must be ready before TX-07 verify");
  }

  const { companies, companyMembers, users } = getCollections(connection);
  const errors = [];

  const remainingManagerUserId = await companies.countDocuments({
    managerUserId: { $exists: true },
  });

  if (remainingManagerUserId > 0) {
    errors.push(
      `${remainingManagerUserId} companies still have managerUserId`,
    );
  }

  const remainingLegacyRoles = await users.countDocuments({
    role: LEGACY_COMPANY_MANAGER_ROLE,
  });

  if (remainingLegacyRoles > 0) {
    errors.push(
      `${remainingLegacyRoles} users still have role COMPANY_MANAGER`,
    );
  }

  const companyStaffWithoutMembership = await users
    .aggregate([
      { $match: { role: USER_ROLE.COMPANY_STAFF } },
      {
        $lookup: {
          from: "companymembers",
          localField: "_id",
          foreignField: "userId",
          as: "memberships",
        },
      },
      { $match: { memberships: { $size: 0 } } },
      { $count: "count" },
    ])
    .toArray();

  if ((companyStaffWithoutMembership[0]?.count ?? 0) > 0) {
    errors.push(
      "COMPANY_STAFF users exist without a CompanyMember membership",
    );
  }

  const companiesWithoutManager = await companies
    .aggregate([
      {
        $lookup: {
          from: "companymembers",
          let: { companyId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$companyId", "$$companyId"] },
                    {
                      $eq: ["$role", COMPANY_MEMBER_ROLE.COMPANY_MANAGER],
                    },
                  ],
                },
              },
            },
          ],
          as: "managers",
        },
      },
      {
        $match: {
          $expr: { $ne: [{ $size: "$managers" }, 1] },
        },
      },
      { $count: "count" },
    ])
    .toArray();

  if ((companiesWithoutManager[0]?.count ?? 0) > 0) {
    errors.push(
      "Companies exist without exactly one COMPANY_MANAGER membership",
    );
  }

  const lockedOrTerminatedManagers = await companyMembers.countDocuments({
    role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    status: { $ne: COMPANY_MEMBER_STATUS.ACTIVE },
  });

  if (lockedOrTerminatedManagers > 0) {
    errors.push(
      "COMPANY_MANAGER memberships exist with non-ACTIVE status",
    );
  }

  if (errors.length > 0) {
    throw new Error(`TX-07 verification failed: ${errors.join("; ")}`);
  }

  return {
    ok: true,
    name,
  };
};

export { migrate, name, verify };
