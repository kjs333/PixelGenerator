export interface History<T extends { bytes: number }> {
  /** 새 항목을 쌓는다. 다시 하기 기록은 사라진다. */
  push(entry: T): void;
  /** 가장 최근 항목을 꺼내 돌려준다(없으면 null). 호출한 쪽이 "바뀌기 전" 상태로 되돌린다. */
  undo(): T | null;
  /** 되돌린 항목을 다시 꺼낸다(없으면 null). 호출한 쪽이 "바뀐 후" 상태로 되돌린다. */
  redo(): T | null;
  canUndo(): boolean;
  canRedo(): boolean;
}

/**
 * 되돌리기 기록. 개수(maxEntries)와 전체 바이트(maxBytes) 상한을 넘으면 가장 오래된 것부터 버린다.
 * 가장 최근 항목 하나는 상한보다 커도 남긴다(방금 한 일은 항상 되돌릴 수 있게).
 */
export function createHistory<T extends { bytes: number }>(
  maxEntries: number,
  maxBytes: number,
): History<T> {
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || !Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError(`상한은 1 이상의 정수여야 해요: ${maxEntries}, ${maxBytes}`);
  }

  const undoStack: T[] = [];
  const redoStack: T[] = [];
  let undoBytes = 0;

  const trim = () => {
    while (undoStack.length > 1 && (undoStack.length > maxEntries || undoBytes > maxBytes)) {
      undoBytes -= undoStack.shift()!.bytes;
    }
  };

  return {
    push(entry) {
      undoStack.push(entry);
      undoBytes += entry.bytes;
      redoStack.length = 0;
      trim();
    },
    undo() {
      const entry = undoStack.pop();
      if (!entry) return null;
      undoBytes -= entry.bytes;
      redoStack.push(entry);
      return entry;
    },
    redo() {
      const entry = redoStack.pop();
      if (!entry) return null;
      undoStack.push(entry);
      undoBytes += entry.bytes;
      return entry;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  };
}
