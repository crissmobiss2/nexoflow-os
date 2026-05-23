/**
 * RFC-4180-aware CSV parser. Handles quoted fields, escaped quotes, CR/LF, and
 * embedded commas/newlines inside cells. Returns array of row objects keyed by
 * the (lowercased, trimmed) header row.
 */

export function parseCsv(text: string): Record<string, string>[] {
  const rows = tokenize(text);
  if (rows.length < 2) return [];
  const headers = rows[0]!.map((h) => h.trim().toLowerCase());
  return rows.slice(1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]!] = (row[i] ?? "").trim();
      }
      return obj;
    });
}

function tokenize(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const n = text.length;

  while (i < n) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // ignore — handled by \n
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += ch;
    i++;
  }

  // Flush last cell/row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

// ─── Lead field mapping ──────────────────────────────────────────────────────

const FIELD_ALIASES: Record<string, string[]> = {
  firstName: ["firstname", "first_name", "first", "fname", "given_name"],
  lastName: ["lastname", "last_name", "last", "lname", "surname", "family_name"],
  email: ["email", "email_address", "emailaddress", "e-mail", "mail"],
  phone: ["phone", "phone_number", "phonenumber", "tel", "telephone", "mobile", "cell"],
  company: ["company", "company_name", "companyname", "organization", "organisation", "org", "business"],
  website: ["website", "url", "web", "site", "domain"],
  industry: ["industry", "sector", "vertical", "category"],
  companySize: ["companysize", "company_size", "employees", "size", "headcount", "team_size"],
  region: ["region", "country", "location", "geography", "geo", "city", "state"],
  jobTitle: ["jobtitle", "job_title", "title", "role", "position"],
  linkedIn: ["linkedin", "linkedin_url", "linkedinurl", "li"],
  techStack: ["techstack", "tech_stack", "technologies", "tech", "stack"],
  painPoints: ["painpoints", "pain_points", "challenges", "problems", "pains"],
  scrapedData: ["scrapeddata", "scraped_data", "raw_data", "rawdata", "notes_raw"],
  notes: ["notes", "note", "comments", "comment", "memo"],
};

export function mapLeadRow(raw: Record<string, string>): Record<string, string> {
  // Also try "name" → split into first+last if firstName/lastName not present
  const mapped: Record<string, string> = {};
  for (const [field, aliasList] of Object.entries(FIELD_ALIASES)) {
    const match = aliasList.find((alias) => raw[alias] !== undefined && raw[alias] !== "");
    if (match) mapped[field] = raw[match]!;
  }
  if (!mapped.firstName && !mapped.lastName && raw.name) {
    const parts = raw.name.trim().split(/\s+/);
    mapped.firstName = parts[0] ?? "";
    if (parts.length > 1) mapped.lastName = parts.slice(1).join(" ");
  }
  if (!mapped.firstName && !mapped.lastName && raw["full_name"]) {
    const parts = raw["full_name"].trim().split(/\s+/);
    mapped.firstName = parts[0] ?? "";
    if (parts.length > 1) mapped.lastName = parts.slice(1).join(" ");
  }
  return mapped;
}

// ─── Dedup key ───────────────────────────────────────────────────────────────

export function dedupKey(row: { email?: string; company?: string; lastName?: string; website?: string }): string {
  if (row.email) return `email:${row.email.toLowerCase().trim()}`;
  if (row.website) return `web:${row.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}`;
  if (row.company && row.lastName) return `cl:${row.company.toLowerCase().trim()}|${row.lastName.toLowerCase().trim()}`;
  if (row.company) return `c:${row.company.toLowerCase().trim()}`;
  return `r:${JSON.stringify(row)}`;
}
