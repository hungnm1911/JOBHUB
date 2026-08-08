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
  companyMembers,
  users,
  session,
}) => {
  const managerUserId = company.managerUserId;

  if (managerUserId == null) {
    return { skipped: true };
  }

  const manager = await users.findOne({ _id: managerUserId }, { session });

  if (!manager) {
    throw new Error(
      `TX-07 legacy manager user ${managerUserId} is missing for company ${company._id}`,
    );
  }

  if (
    manager.role !== LEGACY_COMPANY_MANAGER_ROLE &&
    manager.role !== USER_ROLE.COMPANY_STAFF
  ) {
    throw new Error(
      `TX-07 legacy manager user ${managerUserId} for company ${company._id} has invalid role ${manager.role}; expected ${LEGACY_COMPANY_MANAGER_ROLE} or ${USER_ROLE.COMPANY_STAFF}`,
    );
  }

  const pairMembership = await companyMembers.findOne(
    {
      companyId: company._id,
      userId: managerUserId,
      role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    },
    { session },
  );

  if (!pairMembership) {
    const conflictingMembership = await companyMembers.findOne(
      {
        companyId: company._id,
        role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
      },
      { session },
    );

    if (conflictingMembership) {
      throw new Error(
        `TX-07 cannot preserve legacy Company–Manager pair for company ${company._id}: existing COMPANY_MANAGER membership points to user ${conflictingMembership.userId}, expected ${managerUserId}`,
      );
    }

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
  } else if (pairMembership.status !== COMPANY_MEMBER_STATUS.ACTIVE) {
    await companyMembers.updateOne(
      { _id: pairMembership._id },
      {
        $set: {
          status: COMPANY_MEMBER_STATUS.ACTIVE,
          updatedAt: new Date(),
        },
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

  return { skipped: false };
};

const collectInvariantErrors = async (
  connection,
  { expectManagerUserIdRemoved },
) => {
  const { companies, companyMembers, users } = getCollections(connection);
  const errors = [];

  const remainingManagerUserId = await companies.countDocuments({
    managerUserId: { $exists: true },
  });

  if (expectManagerUserIdRemoved) {
    if (remainingManagerUserId > 0) {
      errors.push(
        `${remainingManagerUserId} companies still have managerUserId`,
      );
    }
  } else {
    const legacyCompanies = await companies
      .find({ managerUserId: { $exists: true, $ne: null } })
      .toArray();

    for (const company of legacyCompanies) {
      const pairMembership = await companyMembers.findOne({
        companyId: company._id,
        userId: company.managerUserId,
        role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
        status: COMPANY_MEMBER_STATUS.ACTIVE,
      });

      if (!pairMembership) {
        errors.push(
          `company ${company._id} is missing ACTIVE COMPANY_MANAGER membership for legacy managerUserId ${company.managerUserId}`,
        );
        continue;
      }

      const manager = await users.findOne({ _id: company.managerUserId });

      if (!manager || manager.role !== USER_ROLE.COMPANY_STAFF) {
        errors.push(
          `legacy manager ${company.managerUserId} for company ${company._id} is not COMPANY_STAFF`,
        );
      }
    }
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

  const managerMemberships = await companyMembers
    .find({ role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER })
    .toArray();

  for (const membership of managerMemberships) {
    const memberUser = await users.findOne({ _id: membership.userId });

    if (!memberUser || memberUser.role !== USER_ROLE.COMPANY_STAFF) {
      errors.push(
        `COMPANY_MANAGER membership ${membership._id} does not point to a COMPANY_STAFF user`,
      );
    }
  }

  return errors;
};

const assertInvariants = async (connection, options) => {
  const errors = await collectInvariantErrors(connection, options);

  if (errors.length > 0) {
    throw new Error(`TX-07 verification failed: ${errors.join("; ")}`);
  }
};

const removeLegacyManagerUserIds = async (companies) => {
  await companies.updateMany(
    { managerUserId: { $exists: true } },
    {
      $unset: { managerUserId: "" },
      $set: { updatedAt: new Date() },
    },
  );
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

  await assertInvariants(connection, { expectManagerUserIdRemoved: false });
  await removeLegacyManagerUserIds(companies);

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

  await assertInvariants(connection, { expectManagerUserIdRemoved: true });

  return {
    ok: true,
    name,
  };
};

export { migrate, name, verify };
