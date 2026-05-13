import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { COLS } from "@/lib/import-utils";

/**
 * All known CRM fields the user can map to.
 * Grouped into ACCOUNT fields and CONTACT fields.
 */
const CRM_FIELDS = {
  account: [
    // ── Core ───────────────────────────────────────
    { key: "companyName", label: "Company / Account Name", required: true },
    { key: "domain", label: "Website / Domain" },
    { key: "homepageUrl", label: "Homepage URL" },
    { key: "industry", label: "Industry / Sector" },
    { key: "description", label: "Description / Notes" },
    { key: "accountType", label: "Account Type" },
    { key: "accountStatus", label: "Account Status" },
    // ── Size & Financials ─────────────────────────
    { key: "employeeCount", label: "Employee Count" },
    { key: "revenue", label: "Revenue / ARR" },
    { key: "vat", label: "VAT / Tax ID" },
    { key: "companyId", label: "Company ID / EIN / Reg. No." },
    // ── Communication ─────────────────────────────
    { key: "accountEmail", label: "Account Email (General)" },
    { key: "accountPhone", label: "Account Phone (Main)" },
    { key: "fax", label: "Fax Number" },
    // ── Billing Address ───────────────────────────
    { key: "billingStreet", label: "Billing Street / Address Line" },
    { key: "billingCity", label: "Billing City" },
    { key: "billingState", label: "Billing State / Province" },
    { key: "billingPostalCode", label: "Billing ZIP / Postal Code" },
    { key: "billingCountry", label: "Billing Country" },
    // ── Shipping Address ──────────────────────────
    { key: "shippingStreet", label: "Shipping Street / Address Line" },
    { key: "shippingCity", label: "Shipping City" },
    { key: "shippingState", label: "Shipping State / Province" },
    { key: "shippingPostalCode", label: "Shipping ZIP / Postal Code" },
    { key: "shippingCountry", label: "Shipping Country" },
    // ── General Location (one-column fallback) ────
    { key: "location", label: "Location / HQ (Combined)" },
    // ── Tech ──────────────────────────────────────
    { key: "techStack", label: "Tech Stack" },
    // ── Social / Web ──────────────────────────────
    { key: "accountLinkedin", label: "Company LinkedIn" },
    { key: "accountTwitter", label: "Company Twitter / X" },
    { key: "accountFacebook", label: "Company Facebook" },
    { key: "accountInstagram", label: "Company Instagram" },
  ],
  contact: [
    // ── Name ──────────────────────────────────────
    { key: "fullName", label: "Full Name", required: true },
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    // ── Role ──────────────────────────────────────
    { key: "title", label: "Job Title / Role" },
    { key: "department", label: "Department" },
    // ── Communication ─────────────────────────────
    { key: "email", label: "Email Address" },
    { key: "additionalEmails", label: "Additional Emails" },
    { key: "personalEmail", label: "Personal Email" },
    { key: "phone", label: "Phone Number" },
    { key: "additionalPhones", label: "Additional Phones" },
    { key: "mobilePhone", label: "Mobile Phone" },
    { key: "officePhone", label: "Office / Direct Phone" },
    // ── Social ────────────────────────────────────
    { key: "linkedinUrl", label: "LinkedIn URL" },
    { key: "contactTwitter", label: "Twitter / X" },
    { key: "contactFacebook", label: "Facebook" },
    { key: "contactInstagram", label: "Instagram" },
    { key: "contactSkype", label: "Skype" },
    // ── Personal ──────────────────────────────────
    { key: "birthday", label: "Birthday / DOB" },
    { key: "contactWebsite", label: "Personal Website" },
    { key: "contactDescription", label: "Contact Notes / Bio" },
    { key: "tags", label: "Tags / Labels" },
    // ── Compliance ────────────────────────────────
    { key: "optInBoolean", label: "Opt-In Confirmation (TRUE/FALSE)" },
    { key: "optInIp", label: "Opt-In IP Address" },
    { key: "optInTimestamp", label: "Opt-In Timestamp" },
  ],
};

/**
 * Extended synonym map for auto-detection, combining import-utils COLS
 * with additional fuzzy matches.
 */
const DETECTION_MAP: Record<string, string[]> = {
  // ── Account Core ────────────────────────────────
  companyName: [...COLS.companyName, "company name", "account name", "business name", "merchant", "client", "client name", "firm", "entity", "dba", "doing business as", "trade name"],
  domain: [...COLS.domain, "web", "company website", "company url", "company domain", "homepage"],
  homepageUrl: [...COLS.homepageUrl, "home page", "web page", "landing page"],
  industry: [...COLS.industry, "category", "field", "niche", "market", "business type", "sic", "sic code", "naics", "naics code"],
  description: [...COLS.description, "bio", "note", "info", "detail", "details", "company description", "account notes"],
  accountType: ["type", "account type", "company type", "business category", "classification", "segment"],
  accountStatus: ["account status", "status", "active", "customer status"],
  // ── Size & Financials ───────────────────────────
  employeeCount: ["employees", "employee count", "headcount", "size", "company size", "team size", "staff", "# employees", "num employees", "number of employees", "employee size"],
  revenue: ["revenue", "arr", "annual revenue", "income", "sales volume", "annual sales", "turnover", "gross revenue", "total revenue"],
  vat: ["vat", "vat number", "tax id", "tax number", "ein", "gst", "gst number", "abn", "tin"],
  companyId: ["company id", "registration number", "reg no", "ein", "company number", "corp id", "business id", "registration", "company registration"],
  // ── Account Communication ───────────────────────
  accountEmail: ["company email", "account email", "general email", "main email", "office email", "corporate email", "business email"],
  accountPhone: ["company phone", "account phone", "main phone", "office phone", "business phone", "corporate phone", "switchboard", "front desk"],
  fax: ["fax", "fax number", "facsimile", "fax #"],
  // ── Billing Address ─────────────────────────────
  billingStreet: ["billing street", "billing address", "billing address line", "billing address 1", "billing addr", "bill street", "bill address", "billing line 1", "invoice address", "street address", "address 1", "address line 1", "street"],
  billingCity: ["billing city", "bill city", "invoice city", "city"],
  billingState: ["billing state", "billing province", "bill state", "billing region", "state", "province", "state/province", "state province", "region"],
  billingPostalCode: ["billing zip", "billing postal code", "billing postcode", "billing zip code", "bill zip", "zip", "postal code", "postcode", "zip code", "zip/postal code"],
  billingCountry: ["billing country", "bill country", "invoice country", "country", "nation"],
  // ── Shipping Address ────────────────────────────
  shippingStreet: ["shipping street", "shipping address", "shipping address 1", "shipping addr", "ship street", "ship address", "delivery address", "mailing address", "address 2", "address line 2"],
  shippingCity: ["shipping city", "ship city", "delivery city", "mailing city"],
  shippingState: ["shipping state", "shipping province", "ship state", "delivery state", "mailing state"],
  shippingPostalCode: ["shipping zip", "shipping postal code", "shipping postcode", "ship zip", "delivery zip", "mailing zip"],
  shippingCountry: ["shipping country", "ship country", "delivery country", "mailing country"],
  // ── General Location ────────────────────────────
  location: ["location", "hq", "headquarters", "geo", "geography", "office location", "hq location", "based in"],
  // ── Tech ────────────────────────────────────────
  techStack: [...COLS.techStack, "tech", "tools", "software", "platform", "crm", "erp", "marketing stack"],
  // ── Account Social ──────────────────────────────
  accountLinkedin: ["company linkedin", "account linkedin", "linkedin company", "linkedin page", "linkedin company url"],
  accountTwitter: ["company twitter", "account twitter", "twitter company", "x company", "company x"],
  accountFacebook: ["company facebook", "account facebook", "facebook page", "facebook company"],
  accountInstagram: ["company instagram", "account instagram", "instagram company", "instagram page"],

  // ── Contact Name ────────────────────────────────
  fullName: [...COLS.fullName, "full name", "contact name", "representative", "rep", "poc", "point of contact", "decision maker"],
  firstName: ["first name", "firstname", "first", "given name", "givenname", "fname", "f name"],
  lastName: ["last name", "lastname", "last", "surname", "family name", "familyname", "lname", "l name"],
  // ── Contact Role ────────────────────────────────
  title: [...COLS.title, "job title", "designation", "dept", "department", "function"],
  department: ["department", "dept", "division", "team", "business unit", "unit", "group"],
  // ── Contact Communication ───────────────────────
  email: [...COLS.email, "e-mail", "mail", "email address", "work email", "business email"],
  additionalEmails: [...COLS.additionalEmails, "alternate email", "personal email", "other email"],
  personalEmail: ["personal email", "private email", "home email", "gmail", "yahoo email", "personal e-mail"],
  phone: [...COLS.phone, "tel", "telephone", "cell", "cellphone", "work phone", "contact number", "contact phone"],
  additionalPhones: [...COLS.additionalPhones, "alternate phone", "home phone", "personal phone"],
  mobilePhone: ["mobile", "mobile phone", "cell phone", "cell", "cellphone", "mobile number", "cell number", "mobile #"],
  officePhone: ["office phone", "direct phone", "direct line", "direct dial", "direct number", "desk phone", "extension", "ext", "work phone"],
  // ── Contact Social ──────────────────────────────
  linkedinUrl: [...COLS.linkedinUrl, "li url", "li profile", "linkedin", "linkedin profile url"],
  contactTwitter: ["twitter", "twitter handle", "twitter url", "x handle", "x url", "x profile"],
  contactFacebook: ["facebook", "facebook url", "facebook profile", "fb", "fb url"],
  contactInstagram: ["instagram", "instagram handle", "instagram url", "ig", "ig handle"],
  contactSkype: ["skype", "skype id", "skype name", "skype handle"],
  // ── Contact Personal ────────────────────────────
  birthday: ["birthday", "date of birth", "dob", "birth date", "birthdate"],
  contactWebsite: ["personal website", "blog", "portfolio", "personal url", "personal site"],
  contactDescription: ["contact notes", "contact bio", "contact description", "about contact", "person notes", "person bio"],
  tags: ["tags", "labels", "categories", "keywords", "groups", "segments"],
  // ── Compliance ──────────────────────────────────
  optInBoolean: ["opt-in", "opt in", "optin", "subscribed", "is_subscribed", "opt_in_boolean"],
  optInIp: ["opt_in_ip", "optin ip", "ip address", "ip_address"],
  optInTimestamp: ["opt_in_timestamp", "optin timestamp", "optin date", "subscribed_date", "opt_in_date"],
};

type DetectedMapping = {
  csvHeader: string;
  crmField: string | null;
  crmFieldLabel: string | null;
  fieldGroup: "account" | "contact" | null;
  confidence: number; // 0-100
  sampleValues: string[];
};

async function bufferToRows(fileName: string | undefined, buffer: Buffer): Promise<Record<string, any>[]> {
  const name = (fileName || "").toLowerCase();
  if (name.endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) return [];

    /**
     * ExcelJS cell values can be complex objects:
     * - Hyperlinks: { text: "email@example.com", hyperlink: "mailto:..." }
     * - Rich text:  { richText: [{ text: "part1" }, { text: "part2" }] }
     * - Formulas:   { formula: "=A1", result: "value" }
     * - Dates:      Date objects
     * - Errors:     { error: "#VALUE!" }
     *
     * We normalize everything to a plain string or number.
     */
    const resolveExcelCellValue = (val: any): string | number => {
      if (val === null || val === undefined) return "";
      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return typeof val === "boolean" ? String(val) : val;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === "object") {
        // Hyperlink: { text: "...", hyperlink: "..." }
        if ("text" in val && typeof val.text === "string") return val.text;
        // Rich text: { richText: [{ text: "..." }, ...] }
        if ("richText" in val && Array.isArray(val.richText)) {
          return val.richText.map((part: any) => part?.text || "").join("");
        }
        // Formula with result: { formula: "...", result: "..." }
        if ("result" in val) {
          const r = val.result;
          if (r === null || r === undefined) return "";
          if (typeof r === "string" || typeof r === "number") return r;
          if (r instanceof Date) return r.toISOString();
          return String(r);
        }
        // Error object: { error: "#VALUE!" }
        if ("error" in val) return "";
        // Fallback
        return String(val);
      }
      return String(val);
    };

    const rows: Record<string, any>[] = [];
    const headers: string[] = [];

    const firstRow = worksheet.getRow(1);
    firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const val = resolveExcelCellValue(cell.value);
      headers[colNumber] = val === "" ? "" : String(val);
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData: Record<string, any> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = resolveExcelCellValue(cell.value);
        }
      });
      rows.push(rowData);
    });
    return rows;
  }
  const text = buffer.toString("utf8");
  return parse(text, { columns: true, skip_empty_lines: true });
}

function detectMapping(header: string, sampleValues: string[]): { crmField: string | null; confidence: number } {
  const h = header.toLowerCase().replace(/[_\-\.]/g, " ").trim();

  // Exact match passes
  for (const [crmField, synonyms] of Object.entries(DETECTION_MAP)) {
    for (const syn of synonyms) {
      if (h === syn) return { crmField, confidence: 95 };
    }
  }

  // Substring / contains match
  for (const [crmField, synonyms] of Object.entries(DETECTION_MAP)) {
    for (const syn of synonyms) {
      if (h.includes(syn) || syn.includes(h)) return { crmField, confidence: 75 };
    }
  }

  // Heuristic: check sample values for email patterns
  const hasEmailPattern = sampleValues.some(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
  if (hasEmailPattern) return { crmField: "email", confidence: 60 };

  // Heuristic: check for phone patterns
  const hasPhonePattern = sampleValues.some(v => /^[\+\(\d][\d\s\-\(\)\.]{6,}$/.test(v));
  if (hasPhonePattern) return { crmField: "phone", confidence: 55 };

  // Heuristic: check for URL patterns
  const hasUrlPattern = sampleValues.some(v => /^(https?:\/\/|www\.)/.test(v));
  if (hasUrlPattern) return { crmField: "domain", confidence: 50 };

  // Heuristic: check for LinkedIn patterns
  const hasLinkedinPattern = sampleValues.some(v => /linkedin\.com/.test(v));
  if (hasLinkedinPattern) return { crmField: "linkedinUrl", confidence: 85 };

  return { crmField: null, confidence: 0 };
}

function getFieldGroup(crmField: string): "account" | "contact" | null {
  if (CRM_FIELDS.account.some(f => f.key === crmField)) return "account";
  if (CRM_FIELDS.contact.some(f => f.key === crmField)) return "contact";
  return null;
}

function getFieldLabel(crmField: string): string | null {
  const accField = CRM_FIELDS.account.find(f => f.key === crmField);
  if (accField) return accField.label;
  const conField = CRM_FIELDS.contact.find(f => f.key === crmField);
  if (conField) return conField.label;
  return null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return new NextResponse("Missing file", { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const rows = await bufferToRows((file as any).name, buffer);

    if (rows.length === 0) {
      return NextResponse.json({ headers: [], mappings: [], sampleRows: [], totalRows: 0, crmFields: CRM_FIELDS });
    }

    const headers = Object.keys(rows[0]);
    const sampleRows = rows.slice(0, 5);

    // Build mappings with auto-detection
    const usedCrmFields = new Set<string>();
    const mappings: DetectedMapping[] = [];

    for (const header of headers) {
      const sampleValues = rows.slice(0, 20).map(r => String(r[header] ?? "").trim()).filter(Boolean);
      let { crmField, confidence } = detectMapping(header, sampleValues);

      // Avoid duplicate mappings - if this field is already taken, reduce confidence
      if (crmField && usedCrmFields.has(crmField)) {
        // Check if this is an "additional" variant
        if (crmField === "email") {
          crmField = "additionalEmails";
          confidence = Math.max(confidence - 10, 50);
        } else if (crmField === "phone") {
          crmField = "additionalPhones";
          confidence = Math.max(confidence - 10, 50);
        } else {
          confidence = Math.max(confidence - 30, 20);
        }
      }

      if (crmField) usedCrmFields.add(crmField);

      mappings.push({
        csvHeader: header,
        crmField,
        crmFieldLabel: crmField ? getFieldLabel(crmField) : null,
        fieldGroup: crmField ? getFieldGroup(crmField) : null,
        confidence,
        sampleValues: sampleValues.slice(0, 3),
      });
    }

    return NextResponse.json({
      headers,
      mappings,
      sampleRows,
      totalRows: rows.length,
      crmFields: CRM_FIELDS,
    });

  } catch (error: any) {
    console.error("[IMPORT_SCAN]", error);
    return new NextResponse(error.message || "Failed to scan file", { status: 500 });
  }
}
