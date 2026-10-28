import { MAX_ART_SIZE, MAX_COLORS, MIN_COLORS } from '../config/constants';
import { cleanupOrphans } from './cleanup';
import { dither } from './dither';
import { dominantDownscale } from './dominant';
import { downscale } from './downscale';
import { quantize } from './quantize';
import { sampleNearest } from './sample';
import type { ConvertOptions, PixelBuffer, RGBA } from './types';

const PALETTE_SAMPLE_PIXELS = 65536;

function assertInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name}은(는) ${min}~${max} 사이의 정수여야 해요: ${value}`);
  }
}

/**
 * 변환 파이프라인. 같은 입력과 옵션은 항상 같은 결과를 낸다.
 *
 * 1. 팔레트: 원본에서 색을 섞지 않고 표본을 뽑아 색 수만큼 줄인다(원본에 있는 색만 쓴다).
 * 2. 디더링 없음: 칸마다 가장 많이 나온 팔레트 색을 쓴다 → 경계가 또렷하다.
 *    그 뒤 옵션이 켜져 있으면 주변과 색이 모두 다른 외톨이 칸을 정리한다.
 *    디더링 있음: 부드러운 색 변화가 필요하므로 평균으로 줄인 뒤 팔레트로 무늬를 만든다.
 */
export function pixelate(
  src: PixelBuffer,
  opt: ConvertOptions,
): { image: PixelBuffer; palette: RGBA[] } {
  assertInRange('가로 해상도', opt.width, 1, MAX_ART_SIZE);
  assertInRange('세로 해상도', opt.height, 1, MAX_ART_SIZE);
  assertInRange('색 수', opt.colors, MIN_COLORS, MAX_COLORS);

  const palette = quantize(sampleNearest(src, PALETTE_SAMPLE_PIXELS), opt.colors);
  if (palette.length === 0) {
    return { image: downscale(src, opt.width, opt.height), palette }; // 전부 투명한 이미지
  }

  if (opt.dither !== 'none') {
    // 디더링은 일부러 외톨이 무늬를 만들므로 외톨이 정리는 적용하지 않는다
    return { image: dither(downscale(src, opt.width, opt.height), palette, opt.dither), palette };
  }
  const image = dominantDownscale(src, opt.width, opt.height, palette);
  return { image: opt.cleanup ? cleanupOrphans(image) : image, palette };
}
