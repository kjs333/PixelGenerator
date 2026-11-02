import { describe, expect, test } from 'vitest';
import { MAX_ACTION_LENGTH } from '../../src/config/constants';
import {
  checkAnimationRequest,
  fitsAnimationLimit,
  formatAmount,
  isFrameCount,
  isUsageCost,
} from '../../src/core/animation';

describe('fitsAnimationLimit', () => {
  test('가로×세로×프레임 수가 524,288 이하이면 만들 수 있다', () => {
    expect(fitsAnimationLimit(256, 256, 8)).toBe(true); // 정확히 상한
    expect(fitsAnimationLimit(256, 256, 16)).toBe(false);
    expect(fitsAnimationLimit(64, 64, 16)).toBe(true);
  });

  test('가로나 세로가 256을 넘으면 만들 수 없다', () => {
    expect(fitsAnimationLimit(257, 8, 4)).toBe(false);
    expect(fitsAnimationLimit(8, 257, 4)).toBe(false);
  });
});

describe('isFrameCount', () => {
  test('4, 8, 16만 허용한다', () => {
    expect([4, 8, 16].every(isFrameCount)).toBe(true);
    expect([0, 6, 12, 32, '8', null].some(isFrameCount)).toBe(false);
  });
});

describe('checkAnimationRequest', () => {
  const ok = { width: 32, height: 32, frameCount: 8, action: 'walking' };

  test('문제가 없으면 null', () => {
    expect(checkAnimationRequest(ok)).toBeNull();
  });

  test('동작 설명이 비었거나 공백뿐이면 action-empty', () => {
    expect(checkAnimationRequest({ ...ok, action: '' })).toBe('action-empty');
    expect(checkAnimationRequest({ ...ok, action: '   ' })).toBe('action-empty');
  });

  test('동작 설명이 최대 글자 수를 넘으면 action-too-long', () => {
    expect(checkAnimationRequest({ ...ok, action: 'a'.repeat(MAX_ACTION_LENGTH) })).toBeNull();
    expect(checkAnimationRequest({ ...ok, action: 'a'.repeat(MAX_ACTION_LENGTH + 1) })).toBe(
      'action-too-long',
    );
  });

  test('허용하지 않는 프레임 수는 bad-frame-count', () => {
    expect(checkAnimationRequest({ ...ok, frameCount: 6 })).toBe('bad-frame-count');
    expect(checkAnimationRequest({ ...ok, frameCount: '8' })).toBe('bad-frame-count');
  });

  test('크기 제한을 넘으면 too-large', () => {
    expect(checkAnimationRequest({ ...ok, width: 256, height: 256, frameCount: 16 })).toBe(
      'too-large',
    );
  });
});

describe('isUsageCost', () => {
  test('단위가 usd·generations이고 금액이 0 이상의 수이면 true', () => {
    expect(isUsageCost({ unit: 'usd', amount: 0.01 })).toBe(true);
    expect(isUsageCost({ unit: 'generations', amount: 0 })).toBe(true);
  });

  test('단위나 금액이 틀리면 false', () => {
    expect(isUsageCost({ unit: 'won', amount: 1 })).toBe(false);
    expect(isUsageCost({ unit: 'usd', amount: -1 })).toBe(false);
    expect(isUsageCost({ unit: 'usd', amount: Number.NaN })).toBe(false);
    expect(isUsageCost(null)).toBe(false);
  });
});

describe('formatAmount', () => {
  test('소수점 넷째 자리까지, 뒤의 0은 지운다', () => {
    expect(formatAmount(0.05)).toBe('0.05');
    expect(formatAmount(1)).toBe('1');
    expect(formatAmount(0.012345)).toBe('0.0123');
    expect(formatAmount(0.1 + 0.2)).toBe('0.3');
  });
});
