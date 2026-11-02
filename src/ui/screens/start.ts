import { copy } from '../copy';
import { dropzone } from '../components/dropzone';
import { renderNotice } from '../components/notice';
import { topBar } from '../components/topBar';
import { h } from '../dom';
import type { Screen } from './types';

/** 변환 시작 화면: 이미지 올리기 / 직접 그리기 중 하나를 고른다. */
export const startScreen: Screen = (host, { store, actions }) => {
  const upload = dropzone(
    [
      h('strong', { class: 'choice-title' }, copy.uploadTitle),
      h('span', {}, copy.uploadHint),
      h('span', { class: 'muted' }, copy.uploadSpec),
    ],
    (file) => void actions.openFile(file),
  );

  const drawChoice = h(
    'button',
    { class: 'choice', type: 'button' },
    h('strong', { class: 'choice-title' }, copy.drawTitle),
    h('span', {}, copy.drawHint),
  );
  drawChoice.addEventListener('click', () => actions.startDrawing());

  const notice = h('p', { class: 'notice', role: 'alert' });

  host.append(
    h(
      'div',
      { class: 'screen landing' },
      topBar(actions),
      h(
        'main',
        { class: 'start' },
        h('h1', { class: 'start-title' }, copy.startTitle),
        h('div', { class: 'choices' }, upload.element, drawChoice),
        h('p', { class: 'muted' }, copy.privacy),
        notice,
        upload.input,
      ),
    ),
  );

  renderNotice(notice, store.getState().notice);
  const unsubscribe = store.subscribe((s) => renderNotice(notice, s.notice));
  return () => {
    unsubscribe();
    host.replaceChildren();
  };
};
