import { rgbToHex } from '../../core/hsv';
import { extractPalette } from '../../core/palette';
import { createPaintEditor } from '../components/paintEditor';
import { copy } from '../copy';
import { h } from '../dom';
import type { Screen } from './types';

/**
 * 결과 수정 화면: 변환한 픽셀 결과를 칸 단위로 고친다(붓은 1×1, 2×2 …).
 * 도구는 직접 그리기와 같은 paintEditor를 쓰고, 왼쪽에 지금 이미지에 쓰인 색을 나열한다.
 * "적용"을 눌러야만 결과에 반영된다.
 */
export const editScreen: Screen = (host, { store, actions }) => {
  const converted = store.getState().converted;
  if (!converted) {
    // 결과가 없으면 고칠 것이 없다. 변환 화면으로 돌려보낸다.
    queueMicrotask(() => actions.cancelEdit());
    return () => host.replaceChildren();
  }

  // ── 사용된 색 목록: 붓질, 실행 취소, 다시 실행 때마다 이미지에서 다시 뽑는다 ──
  const usedColors = h('aside', { class: 'used-colors', 'aria-label': copy.usedColors });
  let swatches: { hex: string; el: HTMLButtonElement }[] = [];

  const syncPressed = () => {
    const current = editor.getColor();
    swatches.forEach(({ hex, el }) => el.setAttribute('aria-pressed', String(hex === current)));
  };

  const renderColors = () => {
    const colors = extractPalette(editor.getBuffer()).map((c) => rgbToHex(c[0], c[1], c[2]));
    swatches = colors.map((hex) => {
      const el = h('button', {
        class: 'swatch swatch-btn',
        type: 'button',
        title: hex,
        'aria-label': `${copy.usedColorItem} ${hex}`,
      });
      el.style.backgroundColor = hex;
      el.addEventListener('click', () => editor.setColor(hex)); // 누르면 그 색이 펜 색이 된다
      return { hex, el };
    });
    usedColors.replaceChildren(
      h('h2', { class: 'aside-title' }, copy.usedColors, h('span', { class: 'muted' }, ` ${colors.length}`)),
      colors.length > 0
        ? h('div', { class: 'swatch-list' }, ...swatches.map((s) => s.el))
        : h('p', { class: 'muted' }, copy.usedColorsEmpty),
    );
    syncPressed();
  };

  const editor = createPaintEditor({
    mode: 'pixel',
    base: converted.image,
    onChange: renderColors,
    onColorChange: syncPressed,
  });
  renderColors();

  const cancel = h('button', { class: 'btn', type: 'button' }, copy.editCancel);
  cancel.addEventListener('click', () => actions.cancelEdit());
  const apply = h('button', { class: 'btn btn-primary', type: 'button' }, copy.editApply);
  apply.addEventListener('click', () => actions.applyEdit(editor.getBuffer()));

  host.append(
    h(
      'main',
      { class: 'screen draw' },
      h('header', { class: 'draw-bar' }, cancel, editor.toolbar, apply),
      h('div', { class: 'edit-body' }, usedColors, editor.stage),
    ),
  );

  return () => {
    editor.destroy();
    host.replaceChildren();
  };
};
