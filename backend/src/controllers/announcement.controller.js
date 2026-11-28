import { getAnnouncement, listAnnouncements, publishAnnouncement } from "../services/announcement.service.js";
import { parseListQuery } from "../utils/list-query.js";
import AppError from "../utils/app-error.js";

const listAnnouncementsHandler = async (request, response, next) => {
  try { return response.json(await listAnnouncements(parseListQuery(request.query))); } catch (error) { return next(error); }
};
const getAnnouncementHandler = async (request, response, next) => {
  try {
    if (Object.keys(request.query).length) throw new AppError(400, "Query parameters not supported");
    return response.json({ announcement: await getAnnouncement(request.params.announcementId) });
  } catch (error) { return next(error); }
};
const publishAnnouncementHandler = async (request, response, next) => {
  try {
    if (Object.keys(request.query).length) throw new AppError(400, "Query parameters not supported");
    return response.status(202).json({ announcement: await publishAnnouncement({ authorUserId: request.auth.user._id, ...request.body }) });
  } catch (error) { return next(error); }
};
export { listAnnouncementsHandler, getAnnouncementHandler, publishAnnouncementHandler };
