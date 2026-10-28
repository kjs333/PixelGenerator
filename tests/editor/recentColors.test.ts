import { describe, expect, test } from 'vitest';
import { addRecentColor } from '../../src/editor/recentColors';

describe('addRecentColor', () => {
  test('새 색은 맨 앞에 들어간다', () => {
    expect(addRecentColor(['#111111', '#222222'], '#333333', 5)).toEqual(['#333333', '#111111', '#222222']);
  });

  test('이미 있는 색은 중복 없이 맨 앞으로 옮긴다', () => {
    expect(addRecentColor(['#111111', '#222222', '#333333'], '#333333', 5)).toEqual([
      '#333333',
      '#111111',
      '#222222',
    ]);
  });

  test('대소문자가 달라도 같은 색으로 본다', () => {
    expect(addRecentColor(['#aabbcc'], '#AABBCC', 5)).toEqual(['#aabbcc']);
  });

  test('개수 상한을 넘으면 가장 오래된 색부터 버린다', () => {
    expect(addRecentColor(['#111111', '#222222', '#333333'], '#444444', 3)).toEqual([
      '#444444',
      '#111111',
      '#222222',
    ]);
  });

  test('올바른 색이 아니면 목록을 그대로 둔다', () => {
    expect(addRecentColor(['#111111'], 'red', 5)).toEqual(['#111111']);
    expect(addRecentColor(['#111111'], '<script>', 5)).toEqual(['#111111']);
  });

  test('원래 목록을 바꾸지 않는다', () => {
    const list = ['#111111', '#222222'];
    addRecentColor(list, '#333333', 5);
    expect(list).toEqual(['#111111', '#222222']);
  });

  test('상한이 1 미만이거나 정수가 아니면 오류를 낸다', () => {
    expect(() => addRecentColor([], '#111111', 0)).toThrow(RangeError);
    expect(() => addRecentColor([], '#111111', 2.5)).toThrow(RangeError);
  });
});
