type Child = Node | string | null | undefined | false;
type Props = Record<string, string | number | boolean | undefined>;

/**
 * DOM 요소를 만드는 작은 도우미.
 * 글자는 텍스트 노드로만 넣는다(HTML로 해석하지 않음). innerHTML은 쓰지 않는다.
 * 이벤트는 만든 뒤 addEventListener로 직접 붙인다.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (key === 'style') throw new Error('style 속성은 CSP 때문에 쓸 수 없어요. CSS 클래스를 쓰세요.');
    if (key === 'class') el.className = String(value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child) el.append(child);
  }
  return el;
}
