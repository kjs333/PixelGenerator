import { describe, expect, test } from 'vitest';
import { scaleToFit } from '../../src/core/fit';

describe('scaleToFit', () => {
  test('상한 안에 들어가면 그대로 둔다', () => {
    expect(scaleToFit(800, 600, 4096)).toEqual({ width: 800, height: 600, scaled: false });
  });

  test('가로가 긴 이미지는 가로를 상한에 맞추고 비율을 지킨다', () => {
    expect(scaleToFit(8192, 4096, 4096)).toEqual({ width: 4096, height: 2048, scaled: true });
  });

  test('세로가 긴 이미지는 세로를 상한에 맞춘다', () => {
    expect(scaleToFit(1000, 5000, 4096)).toEqual({ width: 819, height: 4096, scaled: true });
  });

  test('줄여도 가로세로는 최소 1픽셀이다', () => {
    const out = scaleToFit(100000, 10, 4096);
    expect(out.width).toBe(4096);
    expect(out.height).toBeGreaterThanOrEqual(1);
  });

  test('상한과 정확히 같으면 줄이지 않는다', () => {
    expect(scaleToFit(4096, 4096, 4096).scaled).toBe(false);
  });
});
