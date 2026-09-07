import { NextResponse } from "next/server";

import { getServiceClient, resolveCaller } from "@/lib/server/membership";

type PersonInput = { full_name?: string; email?: string; phone?: string };

function normalizeEmail(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function normalizeE164(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/[^\d+]/g, "") ?? "";
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function parseCsv(text: string): PersonInput[] {
  const rows = text.trim().split(/\r?\n/).map((line) => line.split(",").map((cell) => cell.trim()));
  const headers = rows.shift()?.map((header) => header.toLowerCase());
  if (!headers?.includes("full_name")) throw new Error("CSV needs a full_name column.");
  return rows.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
}

async function findDuplicates(churchId: number, input: PersonInput) {
  const service = getServiceClient();
  if (!service) throw new Error("Server configuration error.");
  const email = normalizeEmail(input.email);
  const phone = normalizeE164(input.phone);
  if (!email && !phone) return [];
  let query = service.from("people").select("person_id,full_name,email,phone").eq("church_id", churchId);
  if (email && phone) query = query.or(`normalized_email.eq.${email},normalized_phone.eq.${phone}`);
  else if (email) query = query.eq("normalized_email", email);
  else query = query.eq("normalized_phone", phone!);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function POST(request: Request): Promise<NextResponse> {
  const caller = await resolveCaller(request.headers.get("authorization"));
  if (!caller) return NextResponse.json({ success: false, error: "Authentication is required." }, { status: 401 });
  if (caller.churchId == null || !["admin", "pastor"].includes(caller.role ?? "")) {
    return NextResponse.json({ success: false, error: "Only an admin or pastor can manage people." }, { status: 403 });
  }
  const service = getServiceClient();
  if (!service) return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });

  try {
    const body = (await request.json()) as { action?: string; person?: PersonInput; csv?: string; confirm_duplicates?: boolean };
    const inputs = body.action === "import_csv" ? parseCsv(body.csv ?? "") : [body.person ?? {}];
    const review = await Promise.all(inputs.map(async (person, index) => ({ index, person, duplicates: await findDuplicates(caller.churchId!, person) })));
    if (!body.confirm_duplicates && review.some((item) => item.duplicates.length)) {
      return NextResponse.json({ success: false, requires_review: true, review }, { status: 409 });
    }
    const invalid = inputs.find((person) => !person.full_name?.trim() || (person.phone && !normalizeE164(person.phone)));
    if (invalid) return NextResponse.json({ success: false, error: "Each person needs a name; phones must be E.164 (for example +14155550100)." }, { status: 400 });
    const { data, error } = await service.from("people").insert(inputs.map((person) => ({ church_id: caller.churchId!, full_name: person.full_name!.trim(), email: normalizeEmail(person.email), phone: normalizeE164(person.phone) })) as never).select("person_id,full_name,email,phone");
    if (error) return NextResponse.json({ success: false, error: error.code === "23505" ? "A matching email or phone already exists." : "Could not create person." }, { status: 409 });
    return NextResponse.json({ success: true, people: data, review });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Invalid import." }, { status: 400 });
  }
}
