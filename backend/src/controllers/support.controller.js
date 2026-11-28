import {
  getSupportMessages,
  listSupportConversations,
  sendSupportMessage,
} from "../services/support.service.js";
import { parseListQuery } from "../utils/list-query.js";
import AppError from "../utils/app-error.js";
const listSupportConversationsHandler = async (request, response, next) => {
  try {
    return response.json(
      await listSupportConversations(
        parseListQuery(request.query, {
          sorts: ["createdAt", "lastMessageAt"],
          defaultSort: "-lastMessageAt",
        }),
      ),
    );
  } catch (error) {
    return next(error);
  }
};
const getSupportMessagesHandler = async (request, response, next) => {
  try {
    return response.json(
      await getSupportMessages({
        userId: request.auth.user._id,
        companyId: request.params.companyId,
        options: parseListQuery(request.query),
      }),
    );
  } catch (error) {
    return next(error);
  }
};
const sendSupportMessageHandler = async (request, response, next) => {
  try {
    if (Object.keys(request.query).length)
      throw new AppError(400, "Query parameters not supported");
    return response.json(
      await sendSupportMessage({
        userId: request.auth.user._id,
        companyId: request.params.companyId,
        ...request.body,
      }),
    );
  } catch (error) {
    return next(error);
  }
};
export {
  listSupportConversationsHandler,
  getSupportMessagesHandler,
  sendSupportMessageHandler,
};
