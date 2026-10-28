import { describe, expect, test } from 'vitest';
import { createHistory } from '../../src/editor/history';

const item = (id: string, bytes = 10) => ({ id, bytes });

describe('history', () => {
  test('새 기록은 되돌릴 것도 다시 할 것도 없다', () => {
    const h = createHistory<ReturnType<typeof item>>(5, 1000);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();
  });

  test('undo는 가장 최근에 쌓은 항목부터 돌려준다', () => {
    const h = createHistory<ReturnType<typeof item>>(5, 1000);
    h.push(item('a'));
    h.push(item('b'));
    expect(h.undo()?.id).toBe('b');
    expect(h.undo()?.id).toBe('a');
    expect(h.undo()).toBeNull();
  });

  test('undo한 항목은 redo로 되살릴 수 있고, 순서는 undo의 반대다', () => {
    const h = createHistory<ReturnType<typeof item>>(5, 1000);
    h.push(item('a'));
    h.push(item('b'));
    h.undo();
    h.undo();
    expect(h.canRedo()).toBe(true);
    expect(h.redo()?.id).toBe('a');
    expect(h.redo()?.id).toBe('b');
    expect(h.redo()).toBeNull();
  });

  test('redo한 항목은 다시 undo할 수 있다', () => {
    const h = createHistory<ReturnType<typeof item>>(5, 1000);
    h.push(item('a'));
    h.undo();
    h.redo();
    expect(h.canUndo()).toBe(true);
    expect(h.undo()?.id).toBe('a');
  });

  test('되돌린 뒤 새 항목을 쌓으면 다시 하기 기록은 사라진다', () => {
    const h = createHistory<ReturnType<typeof item>>(5, 1000);
    h.push(item('a'));
    h.push(item('b'));
    h.undo();
    h.push(item('c'));
    expect(h.canRedo()).toBe(false);
    expect(h.undo()?.id).toBe('c');
    expect(h.undo()?.id).toBe('a');
  });

  test('개수 상한을 넘으면 가장 오래된 항목부터 버린다', () => {
    const h = createHistory<ReturnType<typeof item>>(3, 1000);
    for (const id of ['a', 'b', 'c', 'd']) h.push(item(id));
    expect([h.undo()?.id, h.undo()?.id, h.undo()?.id, h.undo()]).toEqual(['d', 'c', 'b', null]);
  });

  test('바이트 합이 상한을 넘으면 가장 오래된 항목부터 버린다', () => {
    const h = createHistory<ReturnType<typeof item>>(10, 100);
    h.push(item('a', 60));
    h.push(item('b', 60)); // 합 120 > 100 → a를 버린다
    expect([h.undo()?.id, h.undo()]).toEqual(['b', null]);
  });

  test('항목 하나가 바이트 상한보다 커도 가장 최근 하나는 남긴다', () => {
    const h = createHistory<ReturnType<typeof item>>(10, 100);
    h.push(item('big', 500));
    expect(h.undo()?.id).toBe('big');
  });

  test('상한 값이 1 미만이거나 정수가 아니면 오류를 낸다', () => {
    expect(() => createHistory(0, 100)).toThrow(RangeError);
    expect(() => createHistory(5, 0)).toThrow(RangeError);
    expect(() => createHistory(2.5, 100)).toThrow(RangeError);
  });
});
