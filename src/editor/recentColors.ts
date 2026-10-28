import { parseHexColor } from '../io/preferences';

/**
 * 저장된 색 목록에 색을 추가한다. 새 색은 맨 앞에 두고, 이미 있으면 중복 없이 맨 앞으로 옮기며,
 * 개수 상한을 넘으면 가장 오래된 색부터 버린다. 올바른 색이 아니면 목록을 그대로 돌려준다.
 */
export function addRecentColor(list: readonly string[], color: string, max: number): string[] {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`상한은 1 이상의 정수여야 해요: ${max}`);
  }
  const normalized = parseHexColor(color);
  if (!normalized) return [...list];
  return [normalized, ...list.filter((c) => c.toLowerCase() !== normalized)].slice(0, max);
}
