import { describe, expect, test } from 'vitest';
import { loadPenColor, parseHexColor, savePenColor } from '../../src/io/preferences';

/** 테스트용 가짜 저장소 */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key]! : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const brokenStorage = {
  getItem: () => {
    throw new Error('저장소를 읽을 수 없어요');
  },
  setItem: () => {
    throw new Error('저장소에 쓸 수 없어요');
  },
};

describe('parseHexColor', () => {
  test('#rrggbb 형식은 소문자로 맞춰 돌려준다', () => {
    expect(parseHexColor('#FFAA00')).toBe('#ffaa00');
    expect(parseHexColor('#12abEF')).toBe('#12abef');
  });

  test.each(['red', '#fff', '#12345g', '#1234567', 'ffaa00', '', '<script>alert(1)</script>', 'url(x)'])(
    '%s 는 거부한다',
    (value) => {
      expect(parseHexColor(value)).toBeNull();
    },
  );

  test('문자열이 아니면 거부한다', () => {
    expect(parseHexColor(null)).toBeNull();
    expect(parseHexColor(123456)).toBeNull();
    expect(parseHexColor({})).toBeNull();
  });
});

describe('loadPenColor / savePenColor', () => {
  test('저장한 색을 다시 불러온다', () => {
    const storage = fakeStorage();
    savePenColor('#ff8800', storage);
    expect(loadPenColor(storage)).toBe('#ff8800');
  });

  test('저장된 색이 없으면 검정이다', () => {
    expect(loadPenColor(fakeStorage())).toBe('#000000');
  });

  test('저장된 값이 올바른 색이 아니면 검정이다', () => {
    const storage = fakeStorage({ 'pixel-generator.penColor': 'javascript:alert(1)' });
    expect(loadPenColor(storage)).toBe('#000000');
  });

  test('올바르지 않은 색은 저장하지 않는다', () => {
    const storage = fakeStorage();
    savePenColor('not-a-color', storage);
    expect(Object.keys(storage.data)).toEqual([]);
  });

  test('저장소를 쓸 수 없어도(null) 오류 없이 검정이고 저장은 조용히 건너뛴다', () => {
    expect(loadPenColor(null)).toBe('#000000');
    expect(() => savePenColor('#ff0000', null)).not.toThrow();
  });

  test('저장소가 오류를 던져도 오류 없이 검정이고 저장은 조용히 건너뛴다', () => {
    expect(loadPenColor(brokenStorage)).toBe('#000000');
    expect(() => savePenColor('#ff0000', brokenStorage)).not.toThrow();
  });
});
