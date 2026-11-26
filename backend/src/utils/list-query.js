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
    const valid = Array.isArray(values) ? values.includes(query[key]) :
      (values?.literals?.includes(query[key]) || /^[a-fA-F0-9]{24}$/.test(query[key]));
    if (!valid) invalidQuery(key);
    result[key] = /^[a-fA-F0-9]{24}$/.test(query[key]) ? query[key].toLowerCase() : query[key];
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

// Optional list controls preserve existing unpaginated reads. Passthrough keys
// remain validated by their resource's existing parser or tenant guard.
const parseOptionalListQuery = (query = {}, config = {}, passthrough = []) => {
  const controls = Object.fromEntries(Object.entries(query).filter(([key]) =>
    key !== "companyId" && !passthrough.includes(key)));
  if (Object.keys(controls).length === 0) return null;
  return parseListQuery(controls, config);
};

// Pure projection mechanics; resource services supply field/search semantics
// only after enforcing their canonical authorization and eligibility policies.
const projectList = (key, items, options, fields, searchValues = () => [], identity = (item) => item.id ?? item._id) => {
  if (!options) return { [key]: items };
  const keyword = options.q?.toLocaleLowerCase();
  let selected = items.filter((item) => {
    if (keyword && !searchValues(item).some((value) =>
      String(value ?? "").toLocaleLowerCase().includes(keyword))) return false;
    return Object.entries(fields).every(([name, value]) =>
      options[name] === undefined || String(value(item) ?? "") === options[name]);
  });
  const entries = Object.entries(options.sort);
  selected = [...selected].sort((a, b) => {
    for (const [field, direction] of entries) {
      const read = field === "_id" ? identity : fields[field];
      const left = read?.(a) ?? "";
      const right = read?.(b) ?? "";
      const comparison = left < right ? -1 : left > right ? 1 : 0;
      if (comparison) return comparison * direction;
    }
    return 0;
  });
  return {
    [key]: selected.slice(options.skip, options.skip + options.limit),
    pagination: paginationMetadata(options, selected.length),
  };
};

export { parseOptionalListQuery, projectList };
