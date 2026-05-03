/** JSON guardado en `ProjectBoardSnapshot.snapshot` (v1). */
export type BoardSnapshotV1 = {
  version: 1;
  projectId: string;
  projectName: string;
  capturedAt: string;
  columns: Array<{
    id: string;
    name: string;
    order: number;
    wipLimit: number | null;
    color: string | null;
    taskIds: string[];
  }>;
};

export function parseBoardSnapshotV1(raw: string): BoardSnapshotV1 | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const v = o as { version?: unknown; columns?: unknown };
    if (v.version !== 1 || !Array.isArray(v.columns)) return null;
    return o as BoardSnapshotV1;
  } catch {
    return null;
  }
}
