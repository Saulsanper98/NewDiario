import type { PrismaClient } from "@/app/generated/prisma/client";

export type PublishHintKind = "similar_body" | "similar_tags" | "similar_title";

export const PUBLISH_HINT_LABEL: Record<PublishHintKind, string> = {
  similar_title: "Título muy parecido",
  similar_body: "Texto parecido",
  similar_tags: "Etiquetas y texto parecidos",
};

export type PublishHint = {
  kind: PublishHintKind;
  score: number;
  entryId: string;
  title: string;
  createdAt: string;
};

const LOOKBACK_DAYS = 120;
const MAX_CANDIDATES = 400;
const MIN_WORD_LEN = 3;

/** Texto plano para comparar (sin HTML). */
export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9áéíóúüñ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): Set<string> {
  const raw = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9áéíóúüñ\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length >= MIN_WORD_LEN);
  return new Set(raw);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter++;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na.length === 0 || nb.length === 0) return 0;
  if (na === nb) return 1;
  return jaccard(tokenize(na), tokenize(nb));
}

type Row = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  tags: { name: string }[];
};

/**
 * Sugerencias no bloqueantes al publicar: entradas recientes del mismo departamento
 * con texto o etiquetas parecidas, o título muy parecido.
 */
export async function computePublishHints(
  prisma: PrismaClient,
  params: {
    departmentId: string;
    title: string;
    contentHtml: string;
    tagNames: string[];
    excludeEntryId?: string;
  }
): Promise<PublishHint[]> {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const rows = (await prisma.logEntry.findMany({
    where: {
      departmentId: params.departmentId,
      status: "PUBLISHED",
      deletedAt: null,
      createdAt: { gte: since },
      ...(params.excludeEntryId
        ? { id: { not: params.excludeEntryId } }
        : {}),
    },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      tags: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_CANDIDATES,
  })) as Row[];

  const tagSet = new Set(params.tagNames.map((t) => t.toLowerCase().trim()).filter(Boolean));
  const combinedNew =
    plainTextFromHtml(params.contentHtml) + " " + normalizeTitle(params.title);
  const tokensNew = tokenize(combinedNew);

  const hints: PublishHint[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const plain = plainTextFromHtml(row.content) + " " + normalizeTitle(row.title);
    const tokensOld = tokenize(plain);
    const bodySim = jaccard(tokensNew, tokensOld);
    const titleSim = titleSimilarity(params.title, row.title);

    const rowTags = new Set(row.tags.map((t) => t.name.toLowerCase()));
    let sharedTags = 0;
    for (const t of tagSet) {
      if (rowTags.has(t)) sharedTags++;
    }

    let kind: PublishHintKind | null = null;
    let score = 0;

    if (titleSim >= 0.72) {
      kind = "similar_title";
      score = titleSim;
    } else if (bodySim >= 0.28) {
      kind = "similar_body";
      score = bodySim;
    } else if (sharedTags >= 2 && bodySim >= 0.12) {
      kind = "similar_tags";
      score = bodySim + sharedTags * 0.04;
    }

    if (kind && !seen.has(row.id)) {
      seen.add(row.id);
      hints.push({
        kind,
        score,
        entryId: row.id,
        title: row.title,
        createdAt: row.createdAt.toISOString(),
      });
    }
  }

  hints.sort((a, b) => b.score - a.score);
  return hints.slice(0, 5);
}
