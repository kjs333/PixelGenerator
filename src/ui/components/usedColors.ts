import { rgbToHex } from '../../core/hsv';
import { extractPalette } from '../../core/palette';
import { copy } from '../copy';
import { h } from '../dom';
import type { PaintEditor } from './paintEditor';

export interface UsedColors {
  element: HTMLElement;
  /** 이미지에서 쓰인 색을 다시 뽑는다. 붓질, 실행 취소, 다시 실행 뒤에 부른다. */
  render(): void;
  /** 지금 펜 색과 같은 칸을 눌린 상태로 표시한다 */
  syncPressed(): void;
}

/**
 * 편집 중인 그림에 쓰인 색 목록. 누르면 그 색이 펜 색이 된다.
 * 편집기를 만들 때 onChange로 render를 넘겨야 하므로 편집기는 함수로 늦게 받는다.
 */
export function createUsedColors(getEditor: () => PaintEditor): UsedColors {
  const element = h('aside', { class: 'used-colors', 'aria-label': copy.usedColors });
  let swatches: { hex: string; el: HTMLButtonElement }[] = [];

  const syncPressed = () => {
    const current = getEditor().getColor();
    swatches.forEach(({ hex, el }) => el.setAttribute('aria-pressed', String(hex === current)));
  };

  const render = () => {
    const colors = extractPalette(getEditor().getBuffer()).map((c) => rgbToHex(c[0], c[1], c[2]));
    swatches = colors.map((hex) => {
      const el = h('button', {
        class: 'swatch swatch-btn',
        type: 'button',
        title: hex,
        'aria-label': `${copy.usedColorItem} ${hex}`,
      });
      el.style.backgroundColor = hex;
      el.addEventListener('click', () => getEditor().setColor(hex));
      return { hex, el };
    });
    element.replaceChildren(
      h(
        'h2',
        { class: 'aside-title' },
        copy.usedColors,
        h('span', { class: 'muted' }, ` ${colors.length}`),
      ),
      colors.length > 0
        ? h('div', { class: 'swatch-list' }, ...swatches.map((s) => s.el))
        : h('p', { class: 'muted' }, copy.usedColorsEmpty),
    );
    syncPressed();
  };

  return { element, render, syncPressed };
}
