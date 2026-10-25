// Development fixture content. Each role is a real POSITION under the named FIELD.
const FIELDS = Object.freeze([
  {
    name: "Information Technology",
    positions: [
      { name: "Backend Developer", skills: ["Node.js", "REST APIs", "PostgreSQL", "Docker", "Automated testing", "Redis"], work: "Design reliable APIs and data access for a high traffic product", project: "Order and account platform" },
      { name: "Frontend Engineer", skills: ["React", "TypeScript", "Accessibility", "CSS", "Vitest", "API integration"], work: "Build accessible customer interfaces and maintain component quality", project: "Self service customer portal" },
      { name: "Data Engineer", skills: ["Python", "SQL", "Airflow", "Data modeling", "ETL", "Data quality"], work: "Build trustworthy pipelines and documented analytical datasets", project: "Operational analytics warehouse" },
    ],
  },
  {
    name: "Finance & Accounting",
    positions: [
      { name: "Financial Analyst", skills: ["Financial modeling", "Excel", "Forecasting", "Variance analysis", "Power BI", "Reporting"], work: "Prepare forecasts and explain financial performance to business owners", project: "Quarterly planning model" },
      { name: "Management Accountant", skills: ["Management accounting", "Cost allocation", "Month end close", "Excel", "ERP", "Budgeting"], work: "Maintain accurate management accounts and cost center reporting", project: "Cost center reporting redesign" },
      { name: "Risk Analyst", skills: ["Risk assessment", "Internal controls", "SQL", "Regulatory reporting", "Scenario analysis", "Documentation"], work: "Assess operational and financial risks with traceable evidence", project: "Control monitoring dashboard" },
    ],
  },
  {
    name: "Marketing & Communications",
    positions: [
      { name: "Performance Marketing Specialist", skills: ["Google Ads", "Meta Ads", "Attribution", "A/B testing", "Campaign analytics", "Budget optimization"], work: "Run measurable acquisition campaigns and improve conversion quality", project: "Customer acquisition program" },
      { name: "Content Strategist", skills: ["Content planning", "Audience research", "Editorial calendar", "Copywriting", "Analytics", "Brand voice"], work: "Plan useful content across channels and measure audience engagement", project: "Industry knowledge hub" },
      { name: "SEO Specialist", skills: ["Technical SEO", "Keyword research", "Search Console", "Content optimization", "Site audits", "Analytics"], work: "Improve organic discovery through technical and editorial work", project: "Organic growth program" },
    ],
  },
  {
    name: "Human Resources",
    positions: [
      { name: "Talent Acquisition Specialist", skills: ["Sourcing", "Structured interviews", "Applicant tracking", "Candidate experience", "Hiring analytics", "Stakeholder management"], work: "Build fair hiring pipelines and support timely recruiting decisions", project: "Engineering hiring program" },
      { name: "HR Business Partner", skills: ["Employee relations", "Workforce planning", "Coaching", "HR analytics", "Policy guidance", "Change management"], work: "Partner with leaders on people plans and employee development", project: "Workforce planning cycle" },
      { name: "Learning and Development Specialist", skills: ["Learning design", "Facilitation", "Needs assessment", "LMS", "Evaluation", "Curriculum planning"], work: "Create practical learning programs and evaluate their outcomes", project: "Manager development academy" },
    ],
  },
  {
    name: "Engineering",
    positions: [
      { name: "Mechanical Design Engineer", skills: ["SolidWorks", "CAD", "GD&T", "Prototyping", "Design reviews", "Manufacturing drawings"], work: "Design manufacturable mechanical assemblies and verify prototypes", project: "Industrial enclosure redesign" },
      { name: "Electrical Systems Engineer", skills: ["Circuit design", "PLC", "Electrical schematics", "Testing", "Safety standards", "Troubleshooting"], work: "Design and validate safe electrical control systems", project: "Factory automation control panel" },
      { name: "Quality Assurance Engineer", skills: ["Root cause analysis", "ISO 9001", "Inspection plans", "Statistical process control", "Audits", "Corrective action"], work: "Prevent production defects through measurement and corrective action", project: "Supplier quality improvement" },
    ],
  },
]);

const SENIORITIES = Object.freeze([
  { title: "Junior", experience: "UNDER_1_YEAR", salaryMin: 12000000, salaryMax: 19000000, scope: "Implement scoped tasks with review and document what was learned" },
  { title: "Mid-Level", experience: "ONE_TO_THREE_YEARS", salaryMin: 20000000, salaryMax: 32000000, scope: "Own a workstream, coordinate dependencies, and measure delivery outcomes" },
  { title: "Senior", experience: "THREE_TO_FIVE_YEARS", salaryMin: 33000000, salaryMax: 48000000, scope: "Lead complex delivery, mentor teammates, and improve operating standards" },
  { title: "Lead", experience: "FIVE_TO_TEN_YEARS", salaryMin: 49000000, salaryMax: 68000000, scope: "Set technical or professional direction and review cross team decisions" },
]);

const COMPANY_IDS = Object.freeze([
  "6a9a639477dbece313cd6f53",
  "6ad62ee7d1aab04c6576d280",
  "6ad63010d1aab04c6576d284",
  "6ad6369e91cce40c5bafc883",
  "6ad6475a5b0d0c600a67cf78",
  "6adbb0b25f618c61d0f7c4cf",
]);

const SEED_NAMESPACE = "AI-V05-P2-2026-10-25";

export { FIELDS, SENIORITIES, COMPANY_IDS, SEED_NAMESPACE };
