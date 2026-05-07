"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BITACORA_DEPT_ALL_MENTION_ID, matchesDeptAllMentionQuery } from "@/lib/bitacora-mentions";

export type DeptMentionRow =
  | { kind: "dept-all"; id: typeof BITACORA_DEPT_ALL_MENTION_ID; name: string }
  | {
      kind: "user";
      id: string;
      name: string;
      email?: string;
    };

function parseActiveMention(value: string, cursorPos: number): { start: number; query: string } | null {
  const before = value.slice(0, cursorPos);
  const atIdx = before.lastIndexOf("@");
  if (atIdx === -1) return null;
  if (atIdx > 0 && !/\s/.test(before[atIdx - 1] ?? "")) return null;
  const query = before.slice(atIdx + 1);
  if (query.includes(" ") || query.length < 1) return null;
  return { start: atIdx, query };
}

/**
 * Autocompletado @ por departamento (textarea). Inserta texto `@Nombre` / `@all` sin HTML.
 */
export function useDeptMentionAutocomplete(opts: {
  value: string;
  onChange: (next: string) => void;
  departmentId: string | undefined;
  inputRef?: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
}) {
  const { value, onChange, departmentId, inputRef } = opts;
  const dept = departmentId?.trim() ?? "";

  const [showDrop, setShowDrop] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionQuery, setMentionQuery] = useState("");
  const [remoteUsers, setRemoteUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  /** Versión incremental: ignorar respuestas de fetch anteriores o ya descartadas. */
  const fetchGenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const parseAndSync = useCallback(
    (raw: string, cursorPos: number) => {
      const hit = dept ? parseActiveMention(raw, cursorPos) : null;
      if (hit) {
        setMentionStart(hit.start);
        setMentionQuery(hit.query);
        setShowDrop(true);
      } else {
        setShowDrop(false);
      }
    },
    [dept]
  );

  const onControlledInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const next = e.target.value;
      onChange(next);
      parseAndSync(next, e.target.selectionStart ?? next.length);
    },
    [onChange, parseAndSync]
  );

  const onCursorMoved = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const el = e.currentTarget;
      parseAndSync(el.value, el.selectionStart ?? el.value.length);
    },
    [parseAndSync]
  );

  useEffect(() => {
    if (!showDrop || mentionQuery.length < 1 || !dept) {
      setRemoteUsers([]);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    fetchGenRef.current += 1;
    const gen = fetchGenRef.current;

    const tid = window.setTimeout(() => {
      if (fetchGenRef.current !== gen) return;
      void fetch(
        `/api/users/mentions?q=${encodeURIComponent(mentionQuery)}&departmentId=${encodeURIComponent(dept)}&namesOnly=1`,
        { credentials: "same-origin", signal: ac.signal }
      )
        .then((r) => r.json())
        .then((d: { users?: { id: string; name: string; email: string }[] }) => {
          if (fetchGenRef.current !== gen) return;
          setRemoteUsers(d.users ?? []);
        })
        .catch(() => {
          if (fetchGenRef.current !== gen || ac.signal.aborted) return;
          setRemoteUsers([]);
        });
    }, 150);

    return () => {
      clearTimeout(tid);
      ac.abort();
    };
  }, [showDrop, mentionQuery, dept]);

  const bumpGen = useCallback(() => {
    fetchGenRef.current += 1;
  }, []);

  const rows = useMemo((): DeptMentionRow[] => {
    const out: DeptMentionRow[] = [];
    if (matchesDeptAllMentionQuery(mentionQuery)) {
      out.push({
        kind: "dept-all",
        id: BITACORA_DEPT_ALL_MENTION_ID,
        name: "Todo el departamento",
      });
    }
    for (const u of remoteUsers) {
      out.push({ kind: "user", id: u.id, name: u.name, email: u.email });
    }
    return out;
  }, [mentionQuery, remoteUsers]);

  const pickMention = useCallback(
    (row: DeptMentionRow) => {
      if (mentionStart === -1) return;
      const before = value.slice(0, mentionStart);
      const after = value.slice(mentionStart + 1 + mentionQuery.length);
      const snippet = row.kind === "dept-all" ? "@all" : `@${row.name}`;
      const needsSpaceAfter = after.length === 0 || !/^\s/.test(after);
      const next = needsSpaceAfter ? `${before}${snippet} ${after}` : `${before}${snippet}${after}`;
      bumpGen();
      onChange(next);
      setShowDrop(false);
      const pos = before.length + snippet.length + (needsSpaceAfter ? 1 : 0);
      requestAnimationFrame(() => {
        const el = inputRef?.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [mentionStart, mentionQuery, value, onChange, inputRef, bumpGen]
  );

  const dismiss = useCallback(() => {
    bumpGen();
    setShowDrop(false);
  }, [bumpGen]);

  return {
    showMentionDrop: showDrop,
    mentionRows: rows,
    pickMention,
    dismiss,
    handlers: {
      onChange: onControlledInputChange,
      onClick: onCursorMoved,
      onKeyUp: onCursorMoved,
    },
  };
}
