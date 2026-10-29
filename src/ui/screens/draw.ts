import { createPaintEditor } from '../components/paintEditor';
import { copy } from '../copy';
import { h } from '../dom';
import type { Screen } from './types';

/**
 * 그림 화면: 빈 캔버스(512×512)에 그리거나, 올린 사진 위에 펜으로 덧그린다.
 * 그리는 도구는 paintEditor를 결과 수정 화면과 함께 쓴다.
 */
export const drawScreen: Screen = (host, { store, actions }) => {
  const base = store.getState().source; // 있으면 사진 위에 덧그리기, 없으면 빈 캔버스
  const editor = createPaintEditor({ mode: 'freehand', base });

  const leave = h('button', { class: 'btn', type: 'button' }, base ? copy.cancelDrawing : copy.backToStart);
  leave.addEventListener('click', () => (base ? actions.cancelDrawing() : actions.goStart()));
  const next = h('button', { class: 'btn btn-primary', type: 'button' }, copy.toConvert);
  next.addEventListener('click', () => actions.useDrawing(editor.getBuffer()));

  host.append(
    h(
      'main',
      { class: 'screen draw' },
      h('header', { class: 'draw-bar' }, leave, editor.toolbar, next),
      editor.stage,
    ),
  );

  return () => {
    editor.destroy();
    host.replaceChildren();
  };
};
