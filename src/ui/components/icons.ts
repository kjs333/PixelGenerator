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

/** 아이콘 공통 틀(24×24, 선만 그림). 장식용이라 스크린 리더에는 숨긴다. */
function lineIcon(...children: SVGElement[]): SVGSVGElement {
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
    ...children,
  );
}

/** 집 아이콘(첫 화면으로 가는 Home 버튼). */
export function homeIcon(): SVGSVGElement {
  return lineIcon(svg('path', { d: 'M3 11l9-8 9 8' }), svg('path', { d: 'M5 9.5V21h5v-6h4v6h5V9.5' }));
}

/** 다운로드 아이콘(아래 화살표와 받침). */
export function downloadIcon(): SVGSVGElement {
  return lineIcon(svg('path', { d: 'M12 3v12' }), svg('path', { d: 'M7 10l5 5 5-5' }), svg('path', { d: 'M4 17v3h16v-3' }));
}

/** 펜 아이콘(연필, 오른쪽 위에서 왼쪽 아래로). */
export function penIcon(): SVGSVGElement {
  return lineIcon(svg('path', { d: 'M17.5 1.5l5 5L7.5 21.5H2.5v-5L17.5 1.5z' }), svg('path', { d: 'M14.5 4.5l5 5' }));
}

/** 지우개 아이콘(비스듬한 지우개와 바닥 선). */
export function eraserIcon(): SVGSVGElement {
  return lineIcon(
    svg('path', { d: 'M8 20l-4.3-4.3a1.5 1.5 0 0 1 0-2.1L13.6 3.7a1.5 1.5 0 0 1 2.1 0l4.6 4.6a1.5 1.5 0 0 1 0 2.1L10.4 20z' }),
    svg('path', { d: 'M8.5 8.8l6.7 6.7' }),
    svg('path', { d: 'M8 20h12' }),
  );
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
  return lineIcon(dropper);
}
