"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError, ApiResult } from "@/lib/api/api-error";

/** After these, the person may not see this record at all, so nothing already on screen can stay. */
export const losesTheRecord = (error: ApiError) =>
  error.status === 403 || error.status === 404;

/**
 * The guarded read. Each read writes a permanent audit entry, so this reads only on first being shown, after a click
 * on a guarded link, and when the person asks. Nothing else: a refresh or being shown again from hidden leaves the
 * state as it is (ADR 0012, and each feature's live test measures it).
 */
export function useAuditedRead<Data>({
  id,
  read: readOnce,
  takeAsked,
  takeHandedOver,
  onFailure,
  keepOnLoss,
}: {
  id: number;
  read: () => Promise<ApiResult<Data>>;
  takeAsked: (id: number) => boolean;
  takeHandedOver: (id: number) => Data | null;
  onFailure?: (error: ApiError) => void;
  /** Text that's only on screen sits with the record, so a refusal mustn't take it away just now. */
  keepOnLoss?: () => boolean;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [reading, setReading] = useState(false);
  const opened = useRef(false);
  const newest = useRef(0);

  const latest = useRef({
    readOnce,
    takeAsked,
    takeHandedOver,
    onFailure,
    keepOnLoss,
  });
  useEffect(() => {
    latest.current = {
      readOnce,
      takeAsked,
      takeHandedOver,
      onFailure,
      keepOnLoss,
    };
  });

  const lose = useCallback((error: ApiError) => {
    // A read still on its way mustn't put back what was just removed.
    newest.current += 1;
    setReading(false);
    setFailure(error);
    setData(null);
  }, []);

  const read = useCallback(async () => {
    newest.current += 1;
    const request = newest.current;
    setReading(true);

    const result = await latest.current.readOnce();
    if (request !== newest.current) return;

    setReading(false);
    if (result.ok) {
      setData(result.data);
      setFailure(null);
      return;
    }
    if (losesTheRecord(result.error) && !latest.current.keepOnLoss?.()) {
      lose(result.error);
    } else {
      setFailure(result.error);
    }
    latest.current.onFailure?.(result.error);
  }, [lose]);

  /** A change's answer. Whatever a read still on its way says, it's older than this. */
  const replace = useCallback((next: Data) => {
    newest.current += 1;
    setReading(false);
    setData(next);
    setFailure(null);
  }, []);

  /** For a failure with something still to read, as loading replaces the button that asked. */
  const clearFailure = useCallback(() => setFailure(null), []);

  // This runs on mounting, and again each time a held page is shown. The ref and the mark are what decide.
  useEffect(() => {
    const asked = latest.current.takeAsked(id);
    if (opened.current && !asked) return;
    opened.current = true;

    const handedOver = latest.current.takeHandedOver(id);
    if (handedOver) {
      // This comes from outside React, and taking it during render could use it up on a hidden prerender.
      setData(handedOver);
      return;
    }
    void read();
  }, [id, read]);

  return { data, failure, reading, read, lose, replace, clearFailure };
}
