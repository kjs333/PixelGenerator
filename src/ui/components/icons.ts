const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG 요소를 DOM으로 만든다. innerHTML은 쓰지 않는다(보안 규칙). */
function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
  ...children: SVGElement[]
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

/**
 * 스포이드 아이콘. 선 색은 글자색(currentColor)을 따라가서 버튼 상태에 맞게 바뀐다.
 * 장식용이라 스크린 리더에는 숨기고, 버튼 쪽에서 이름(aria-label)을 붙인다.
 */
export function eyedropperIcon(): SVGSVGElement {
  // 위쪽을 보는 스포이드(고무 공, 고리, 끝이 뾰족한 관)를 그린 뒤 45도 돌려 오른쪽 위에서 왼쪽 아래로 향하게 한다
  const dropper = svg(
    'g',
    { transform: 'rotate(45 12 12)' },
    svg('rect', { x: '10', y: '2', width: '4', height: '7', rx: '2' }),
    svg('rect', { x: '8', y: '9', width: '8', height: '3', rx: '1' }),
    svg('path', { d: 'M10 12v6l2 4 2-4v-6' }),
  );
  return svg(
    'svg',
    {
      class: 'icon',
      viewBox: '0 0 24 24',
      width: '18',
      height: '18',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.75',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    dropper,
  );
}
