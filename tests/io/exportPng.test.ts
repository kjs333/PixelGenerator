import { describe, expect, test } from 'vitest';
import { exportFileName } from '../../src/io/exportPng';

describe('exportFileName', () => {
  test('크기, 배율, 날짜와 시각으로 파일 이름을 만든다', () => {
    const date = new Date(2026, 9, 28, 15, 1, 2); // 2026-10-28 15:01:02
    expect(exportFileName(32, 32, 4, date)).toBe('pixel-32x32-x4-20261028-150102.png');
  });

  test('원래 크기는 x1로 표시한다', () => {
    const date = new Date(2026, 0, 5, 3, 4, 5);
    expect(exportFileName(16, 24, 1, date)).toBe('pixel-16x24-x1-20260105-030405.png');
  });

  test('파일 이름에는 숫자, 영문 소문자, 하이픈, 점만 들어간다', () => {
    expect(exportFileName(64, 48, 8, new Date(2026, 11, 31, 23, 59, 59))).toMatch(/^[a-z0-9.-]+$/);
  });

  test('크기나 배율이 1 미만이거나 정수가 아니면 오류를 낸다', () => {
    expect(() => exportFileName(0, 32, 1)).toThrow(RangeError);
    expect(() => exportFileName(32, 32.5, 1)).toThrow(RangeError);
    expect(() => exportFileName(32, 32, 0)).toThrow(RangeError);
  });
});
