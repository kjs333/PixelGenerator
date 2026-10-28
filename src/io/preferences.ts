/** 브라우저에 남겨 두는 사용자 설정. 서버로는 아무것도 보내지 않는다. */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PEN_COLOR_KEY = 'pixel-generator.penColor';
export const DEFAULT_PEN_COLOR = '#000000';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** #rrggbb 형식이면 소문자로 맞춰 돌려주고, 아니면 null. 저장된 값이 변조돼도 이 형식만 통과한다. */
export function parseHexColor(value: unknown): string | null {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : null;
}

/** 시크릿 모드나 저장소 차단 환경에서는 접근만 해도 오류가 날 수 있어서 null로 처리한다. */
function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadPenColor(storage: KeyValueStorage | null = defaultStorage()): string {
  try {
    return parseHexColor(storage?.getItem(PEN_COLOR_KEY)) ?? DEFAULT_PEN_COLOR;
  } catch {
    return DEFAULT_PEN_COLOR;
  }
}

export function savePenColor(color: string, storage: KeyValueStorage | null = defaultStorage()): void {
  const valid = parseHexColor(color);
  if (!valid) return;
  try {
    storage?.setItem(PEN_COLOR_KEY, valid);
  } catch {
    // 저장하지 못해도 그리기는 계속할 수 있어야 한다
  }
}
