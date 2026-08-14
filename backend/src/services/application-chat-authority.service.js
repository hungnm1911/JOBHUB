import APPLICATION_STATUS from "../constants/application-status.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";
import USER_STATUS from "../constants/user-status.js";

const TERMINAL_APPLICATION_STATUSES = Object.freeze([
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
]);

const isTerminalApplicationStatus = (status) => {
  return TERMINAL_APPLICATION_STATUSES.includes(status);
};

const isAccountLifecycleRestricted = ({ userStatus, membershipStatus } = {}) => {
  return (
    userStatus === USER_STATUS.LOCKED ||
    userStatus === USER_STATUS.TERMINATED ||
    membershipStatus === COMPANY_MEMBER_STATUS.LOCKED ||
    membershipStatus === COMPANY_MEMBER_STATUS.TERMINATED
  );
};

/**
 * Pure Application Conversation Chat authority evaluation (V11 F05 foundation).
 *
 * Encodes eligibility-loss window (BR-26 / BR-55), post-Automatic-Unassign
 * PAUSED_UNASSIGNED behavior (BR-22 / BR-27), and BR-54 denial when User or
 * CompanyMember is LOCKED/TERMINATED. Does not implement Send/read HTTP,
 * Company-lock freeze surfaces, or terminal read-only workflows — later Chat
 * slices must call this with current Application / eligibility facts and must
 * not wait for Automatic Unassign persistence before applying eligibility loss.
 *
 * @param {object} input
 * @param {boolean} input.conversationExists
 * @param {string} input.applicationStatus
 * @param {boolean} input.isUnassigned
 * @param {boolean} input.companyIsOperational
 * @param {null | {
 *   companyMemberId: string,
 *   userId: string,
 *   membershipStatus: string,
 *   userStatus: string,
 *   isContinuouslyEligible: boolean,
 * }} input.currentAssignee
 * @param {{
 *   kind: "CANDIDATE" | "RECRUITER",
 *   userId: string,
 *   companyMemberId?: string | null,
 *   membershipStatus?: string | null,
 *   userStatus?: string | null,
 * }} input.actor
 * @returns {{ canRead: boolean, canSendNormal: boolean, mode: string }}
 */
const evaluateApplicationConversationChatAuthority = ({
  conversationExists = false,
  applicationStatus,
  isUnassigned = false,
  companyIsOperational = true,
  currentAssignee = null,
  actor,
} = {}) => {
  if (!conversationExists || !actor?.kind || !actor?.userId) {
    return { canRead: false, canSendNormal: false, mode: "NOT_CREATED" };
  }

  const applicationIsTerminal = isTerminalApplicationStatus(applicationStatus);

  // BR-54: LOCKED / TERMINATED User or CompanyMember never retain Chat access
  // via persisted or historical association.
  if (
    actor.kind === "RECRUITER" &&
    isAccountLifecycleRestricted({
      userStatus: actor.userStatus,
      membershipStatus: actor.membershipStatus,
    })
  ) {
    return {
      canRead: false,
      canSendNormal: false,
      mode: applicationIsTerminal
        ? "READ_ONLY"
        : isUnassigned
          ? "PAUSED_UNASSIGNED"
          : "ELIGIBILITY_LOSS_WINDOW",
    };
  }

  if (applicationIsTerminal) {
    // Terminal read-only surfaces are outside Slice 04; deny Send here and leave
    // full historical read authorization to the terminal slice.
    return { canRead: false, canSendNormal: false, mode: "READ_ONLY" };
  }

  if (!companyIsOperational) {
    // Company-lock freeze Send is owned by a later slice; deny Send immediately
    // so eligibility/Company-loss cannot wait on Assignment State alone.
    return { canRead: false, canSendNormal: false, mode: "FROZEN_COMPANY" };
  }

  // Eligibility-loss window: Assignee still persisted, but continuous
  // eligibility is already lost. Authority must not wait for A → NONE (BR-26 /
  // BR-55). Candidate may read history only; outgoing Recruiter may not read
  // or send; no actor may send NORMAL Message.
  if (
    !isUnassigned &&
    currentAssignee &&
    currentAssignee.isContinuouslyEligible !== true
  ) {
    if (actor.kind === "CANDIDATE") {
      return {
        canRead: true,
        canSendNormal: false,
        mode: "ELIGIBILITY_LOSS_WINDOW",
      };
    }

    return {
      canRead: false,
      canSendNormal: false,
      mode: "ELIGIBILITY_LOSS_WINDOW",
    };
  }

  // PAUSED_UNASSIGNED after Manual / Automatic Unassign (BR-22 / BR-27).
  if (isUnassigned) {
    if (actor.kind === "CANDIDATE") {
      return {
        canRead: true,
        canSendNormal: false,
        mode: "PAUSED_UNASSIGNED",
      };
    }

    return {
      canRead: false,
      canSendNormal: false,
      mode: "PAUSED_UNASSIGNED",
    };
  }

  // ACTIVE Conversation: Candidate and current continuously eligible Assignee
  // may read and send. Full Send race protection remains a later slice.
  if (actor.kind === "CANDIDATE") {
    return { canRead: true, canSendNormal: true, mode: "ACTIVE" };
  }

  if (
    actor.kind === "RECRUITER" &&
    currentAssignee &&
    currentAssignee.isContinuouslyEligible === true &&
    actor.companyMemberId != null &&
    String(actor.companyMemberId) === String(currentAssignee.companyMemberId)
  ) {
    return { canRead: true, canSendNormal: true, mode: "ACTIVE" };
  }

  return { canRead: false, canSendNormal: false, mode: "ACTIVE" };
};

export { evaluateApplicationConversationChatAuthority };
