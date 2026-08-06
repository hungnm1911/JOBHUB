const CLOUDINARY_ROOT_FOLDER = "jobhub";

const CLOUDINARY_FOLDER = Object.freeze({
  // Chỉ dùng cho route kiểm thử Cloudinary.
  TEST: `${CLOUDINARY_ROOT_FOLDER}/test`,

  // User
  USER_AVATARS:
    `${CLOUDINARY_ROOT_FOLDER}/users/avatars`,

  // Company
  COMPANY_LOGOS:
    `${CLOUDINARY_ROOT_FOLDER}/companies/logos`,

  COMPANY_BANNERS:
    `${CLOUDINARY_ROOT_FOLDER}/companies/banners`,

  // CandidateCV có sourceType = UPLOADED.
  CANDIDATE_UPLOADED_CVS:
    `${CLOUDINARY_ROOT_FOLDER}/candidate-cvs/uploaded`,

  // PDF đóng băng khi ứng viên nộp đơn.
  APPLICATION_SUBMITTED_CV_SNAPSHOTS:
    `${CLOUDINARY_ROOT_FOLDER}/applications/submitted-cv-snapshots`,

  // PDF đóng băng khi nhà tuyển dụng gửi lời mời.
  JOB_INVITATION_INVITED_CV_SNAPSHOTS:
    `${CLOUDINARY_ROOT_FOLDER}/job-invitations/invited-cv-snapshots`,
});

export default CLOUDINARY_FOLDER;