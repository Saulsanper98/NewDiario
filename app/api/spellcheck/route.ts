import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  text: z.string().min(1).max(20000),
  language: z.string().default("es"),
});

type LanguageToolMatch = {
  offset: number;
  length: number;
  replacements: { value: string }[];
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { text, language } = parsed.data;
  const form = new URLSearchParams({
    text,
    language,
    enabledOnly: "false",
  });

  const ltUrl = process.env.LANGUAGE_TOOL_API_URL ?? "https://api.languagetool.org/v2/check";
  const res = await fetch(ltUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }).catch(() => null);

  if (!res || !res.ok) {
    return NextResponse.json(
      { error: "No se pudo revisar ortografía en este momento" },
      { status: 502 }
    );
  }

  const data = (await res.json()) as { matches?: LanguageToolMatch[] };
  const matches = (data.matches ?? []).filter(
    (m) => m.length > 0 && m.replacements && m.replacements.length > 0
  );

  let corrected = text;
  let cursorShift = 0;
  for (const m of matches) {
    const replacement = m.replacements[0]?.value;
    if (!replacement) continue;
    const from = m.offset + cursorShift;
    const to = from + m.length;
    if (from < 0 || to > corrected.length) continue;
    corrected = corrected.slice(0, from) + replacement + corrected.slice(to);
    cursorShift += replacement.length - m.length;
  }

  return NextResponse.json({
    correctedText: corrected,
    corrections: matches.length,
  });
}

