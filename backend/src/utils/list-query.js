import AppError from "./app-error.js";

const invalidQuery = (field) => {
  throw new AppError(400, `Invalid ${field} query`, { field });
};

// Transport-only parsing, shared by V1–V4 reads. Other versions keep their contracts.
const parseListQuery = (query = {}, {
  filters = {}, sorts = ["createdAt"], defaultSort = "-createdAt", optional = false,
} = {}) => {
  const allowed = new Set(optional ? ["page", "limit"] : ["page", "limit", "q", "sort", ...Object.keys(filters)]);
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key) || typeof value !== "string") invalidQuery(key);
  }
  const integer = (key, fallback, maximum) => {
    if (query[key] === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(query[key])) invalidQuery(key);
    const value = Number(query[key]);
    if (!Number.isSafeInteger(value) || value > maximum) invalidQuery(key);
    return value;
  };
  const page = integer("page", 1, Number.MAX_SAFE_INTEGER);
  const limit = integer("limit", 20, 100);
  if (!Number.isSafeInteger((page - 1) * limit)) invalidQuery("page");
  const sort = query.sort ?? defaultSort;
  const sortField = sort.replace(/^-/, "");
  if (!sorts.includes(sortField)) invalidQuery("sort");
  const result = {
    page, limit, skip: (page - 1) * limit,
    sort: { [sortField]: sort.startsWith("-") ? -1 : 1, _id: sort.startsWith("-") ? -1 : 1 },
    paginated: !optional || query.page !== undefined || query.limit !== undefined,
  };
  if (query.q !== undefined) {
    if (!query.q.trim() || query.q.length > 200) invalidQuery("q");
    result.q = query.q.trim();
  }
  for (const [key, values] of Object.entries(filters)) {
    if (query[key] === undefined) continue;
    if (values ? !values.includes(query[key]) : !/^[a-fA-F0-9]{24}$/.test(query[key])) {
      invalidQuery(key);
    }
    result[key] = query[key];
  }
  return result;
};

const paginationMetadata = ({ page, limit }, total) => ({
  page, limit, total, totalPages: Math.ceil(total / limit),
});

const catalogPage = (key, items, options) => options.paginated
  ? { [key]: items.slice(options.skip, options.skip + options.limit), pagination: paginationMetadata(options, items.length) }
  : { [key]: items };

export { parseListQuery, paginationMetadata, catalogPage };
