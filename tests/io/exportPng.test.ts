import { describe, expect, test } from 'vitest';
import { animationFileName, exportFileName, frameFileName } from '../../src/io/exportPng';

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

describe('animationFileName', () => {
  const date = new Date(2026, 9, 30, 9, 8, 7);

  test('시트는 png, 낱장 묶음은 zip이고 프레임 크기와 개수가 들어간다', () => {
    expect(animationFileName('sheet', 32, 32, 8, date)).toBe('sheet-32x32-8f-20261030-090807.png');
    expect(animationFileName('frames', 48, 32, 16, date)).toBe('frames-48x32-16f-20261030-090807.zip');
  });

  test('크기나 프레임 수가 1 미만이면 오류를 낸다', () => {
    expect(() => animationFileName('sheet', 0, 32, 8)).toThrow(RangeError);
    expect(() => animationFileName('frames', 32, 32, 0)).toThrow(RangeError);
  });
});

describe('frameFileName', () => {
  test('1부터 두 자리로 번호를 붙여 이름순 정렬이 프레임 순서와 같다', () => {
    expect(frameFileName(0, 8)).toBe('frame-01.png');
    expect(frameFileName(15, 16)).toBe('frame-16.png');
    expect(frameFileName(0, 120)).toBe('frame-001.png');
  });
});
