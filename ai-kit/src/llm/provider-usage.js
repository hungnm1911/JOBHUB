const normalizeTokenCount = (value) => {
  return Number.isInteger(value) && value >= 0 ? value : null;
};

const logProviderUsage = ({ logger, provider, model, usage }) => {
  const inputTokens = normalizeTokenCount(usage?.inputTokens);
  const outputTokens = normalizeTokenCount(usage?.outputTokens);
  const reportedTotalTokens = normalizeTokenCount(usage?.totalTokens);
  const totalTokens = reportedTotalTokens
    ?? (inputTokens !== null && outputTokens !== null
      ? inputTokens + outputTokens
      : null);

  logger.info("AI provider API usage", {
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    cached_tokens: normalizeTokenCount(usage?.cachedTokens),
  });
};

export { logProviderUsage };
