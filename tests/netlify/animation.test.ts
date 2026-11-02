import { describe, expect, test } from 'vitest';
import {
  isJobId,
  parseAnimateBody,
  parseJobResponse,
  parseStartResponse,
  parseUsage,
} from '../../netlify/lib/animation';
import { bytesToBase64 } from '../../src/io/base64';
import { pngHeader } from '../helpers';

const png = (w: number, h: number) => bytesToBase64(pngHeader(w, h));

describe('parseAnimateBody', () => {
  test('올바른 본문이면 동작 설명 앞뒤 공백을 지우고 돌려준다', () => {
    const image = png(32, 32);
    expect(parseAnimateBody({ image, action: '  walking ', frameCount: 8 })).toEqual({
      ok: true,
      value: { image, action: 'walking', frameCount: 8, transparent: false, enhance: false },
    });
  });

  test('투명 배경·설명 늘리기 선택을 그대로 넘기고, 불리언이 아니면 bad-body', () => {
    const image = png(16, 16);
    const base = { image, action: 'walk', frameCount: 4 };
    expect(parseAnimateBody({ ...base, transparent: true, enhance: true })).toMatchObject({
      ok: true,
      value: { transparent: true, enhance: true },
    });
    expect(parseAnimateBody({ ...base, transparent: 'yes' })).toEqual({
      ok: false,
      error: 'bad-body',
    });
    expect(parseAnimateBody({ ...base, enhance: 1 })).toEqual({ ok: false, error: 'bad-body' });
  });

  test('객체가 아니면 bad-body', () => {
    expect(parseAnimateBody(null)).toEqual({ ok: false, error: 'bad-body' });
    expect(parseAnimateBody('x')).toEqual({ ok: false, error: 'bad-body' });
  });

  test('이미지가 없거나 PNG가 아니면 bad-image', () => {
    expect(parseAnimateBody({ action: 'walk', frameCount: 8 })).toEqual({
      ok: false,
      error: 'bad-image',
    });
    expect(parseAnimateBody({ image: 'AQID', action: 'walk', frameCount: 8 })).toEqual({
      ok: false,
      error: 'bad-image',
    });
    expect(parseAnimateBody({ image: '@@@', action: 'walk', frameCount: 8 })).toEqual({
      ok: false,
      error: 'bad-image',
    });
  });

  test('이미지 크기는 브라우저가 보낸 값이 아니라 PNG 머리에서 읽어 검사한다', () => {
    expect(
      parseAnimateBody({
        image: png(256, 256),
        action: 'walk',
        frameCount: 16,
        width: 8,
        height: 8,
      }),
    ).toEqual({
      ok: false,
      error: 'too-large',
    });
  });

  test('동작 설명이나 프레임 수가 틀리면 그 이유를 돌려준다', () => {
    expect(parseAnimateBody({ image: png(8, 8), action: ' ', frameCount: 8 })).toEqual({
      ok: false,
      error: 'action-empty',
    });
    expect(parseAnimateBody({ image: png(8, 8), action: 'walk', frameCount: 5 })).toEqual({
      ok: false,
      error: 'bad-frame-count',
    });
  });
});

describe('parseStartResponse', () => {
  test('작업 번호와 늘린 설명을 꺼낸다', () => {
    expect(
      parseStartResponse({ background_job_id: 'job-1', enhanced_prompt: '  a fish swims  ' }),
    ).toMatchObject({
      jobId: 'job-1',
      enhancedPrompt: 'a fish swims',
    });
  });

  test('늘린 설명이 없거나 비었으면 null', () => {
    expect(parseStartResponse({ background_job_id: 'job-1' })).toMatchObject({
      jobId: 'job-1',
      enhancedPrompt: null,
    });
    expect(parseStartResponse({ background_job_id: 'job-1', enhanced_prompt: ' ' })).toMatchObject({
      jobId: 'job-1',
      enhancedPrompt: null,
    });
  });

  test('늘린 설명은 2000자까지만 넘긴다', () => {
    const result = parseStartResponse({
      background_job_id: 'j',
      enhanced_prompt: 'a'.repeat(3000),
    });
    expect(result?.enhancedPrompt).toHaveLength(2000);
  });

  test('생성 비용과 설명 늘리기 비용을 따로 꺼낸다', () => {
    const body = {
      background_job_id: 'j',
      usage: { type: 'generations', usd: null, generations: 1 },
      enhance_usage: { type: 'generations', usd: null, generations: 0.05 },
    };
    expect(parseStartResponse(body)?.cost).toEqual({
      generation: { unit: 'generations', amount: 1 },
      enhance: { unit: 'generations', amount: 0.05 },
    });
    expect(parseStartResponse({ background_job_id: 'j' })?.cost).toEqual({
      generation: null,
      enhance: null,
    });
  });

  test('작업 번호가 없으면 null', () => {
    expect(parseStartResponse({ enhanced_prompt: 'x' })).toBeNull();
    expect(parseStartResponse(null)).toBeNull();
  });
});

describe('parseUsage', () => {
  test('type이 generations면 생성분, 아니면 달러로 읽는다', () => {
    expect(parseUsage({ type: 'generations', usd: null, generations: 0.05 })).toEqual({
      unit: 'generations',
      amount: 0.05,
    });
    expect(parseUsage({ type: 'usd', usd: 0.012, generations: null })).toEqual({
      unit: 'usd',
      amount: 0.012,
    });
    expect(parseUsage({ usd: 0.5 })).toEqual({ unit: 'usd', amount: 0.5 }); // type 기본값은 usd
  });

  test('금액이 없거나 수가 아니면 null', () => {
    expect(parseUsage(null)).toBeNull();
    expect(parseUsage({ type: 'usd', usd: null })).toBeNull();
    expect(parseUsage({ type: 'generations', generations: 'one' })).toBeNull();
    expect(parseUsage({ type: 'usd', usd: -1 })).toBeNull();
  });
});

describe('isJobId', () => {
  test('영문, 숫자, -, _만 허용한다(주소에 끼워 넣는 값이므로)', () => {
    expect(isJobId('a1b2-c3_d4')).toBe(true);
    expect(isJobId(null)).toBe(false);
    expect(isJobId('')).toBe(false);
    expect(isJobId('../balance')).toBe(false);
    expect(isJobId('a?b=1')).toBe(false);
  });
});

describe('parseJobResponse', () => {
  test('processing, failed는 상태만 돌려준다', () => {
    expect(
      parseJobResponse({ id: 'x', status: 'processing', last_response: { queue_position: 2 } }),
    ).toEqual({
      status: 'processing',
    });
    expect(
      parseJobResponse({ id: 'x', status: 'failed', last_response: { detail: 'oops' } }),
    ).toEqual({
      status: 'failed',
    });
  });

  test('completed면 last_response.images의 base64를 순서대로 꺼낸다', () => {
    const body = {
      status: 'completed',
      last_response: {
        images: [
          { type: 'base64', base64: 'AAA=', format: 'png' },
          { type: 'base64', base64: 'data:image/png;base64,BBB=', format: 'png' },
        ],
      },
    };
    expect(parseJobResponse(body)).toEqual({ status: 'completed', frames: ['AAA=', 'BBB='] });
  });

  test('모양이 예상과 다르면 null', () => {
    expect(parseJobResponse(null)).toBeNull();
    expect(parseJobResponse({ status: 'queued' })).toBeNull();
    expect(parseJobResponse({ status: 'completed', last_response: null })).toBeNull();
    expect(parseJobResponse({ status: 'completed', last_response: { images: [] } })).toBeNull();
    expect(
      parseJobResponse({ status: 'completed', last_response: { images: [{ base64: 1 }] } }),
    ).toBeNull();
  });
});
