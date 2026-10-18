import { createAiKit } from "@jobhub/ai-kit";

import config from "../config/index.js";
import logger from "../utils/logger.js";

const aiKit = createAiKit({
  llm: config.aiKit.llm,
  logger,
});

export { aiKit };
