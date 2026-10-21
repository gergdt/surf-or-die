import type { SetLog } from "@/lib/types";
import { uid } from "@/lib/utils";

export type SetLogWithId = SetLog & { id: string };

export function getSetLogId(set: SetLog): string | undefined {
  const id = (set as SetLogWithId).id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

export function withSetLogId(set: SetLog = {}): SetLogWithId {
  const copy: SetLogWithId = { ...set, id: getSetLogId(set) ?? uid("set") };
  return copy;
}

export function withSetLogIds(sets: SetLog[]): SetLogWithId[] {
  return sets.map((set) => withSetLogId(set));
}

export function setLogKey(set: SetLog, fallbackIndex: number): string {
  return getSetLogId(set) ?? `set-${fallbackIndex}`;
}
