import { copy } from '../copy';
import { renderNotice } from '../components/notice';
import { h } from '../dom';
import type { Screen } from './types';

const ACCEPT = 'image/png,image/jpeg,image/webp';

/** 시작 화면: 이미지 올리기 / 직접 그리기 중 하나를 고른다. */
export const startScreen: Screen = (host, { store, actions }) => {
  const input = h('input', { type: 'file', accept: ACCEPT, class: 'visually-hidden', tabindex: '-1' });
  const openPicker = () => input.click();

  const dropzone = h(
    'div',
    { class: 'choice dropzone', role: 'button', tabindex: '0' },
    h('strong', { class: 'choice-title' }, copy.uploadTitle),
    h('span', {}, copy.uploadHint),
    h('span', { class: 'muted' }, copy.uploadSpec),
  );
  dropzone.addEventListener('click', openPicker);
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  });
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-over');
    const file = e.dataTransfer?.files[0];
    if (file) void actions.openFile(file);
  });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = ''; // 같은 파일을 다시 골라도 change가 일어나게
    if (file) void actions.openFile(file);
  });

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
      'main',
      { class: 'screen start' },
      h('div', { class: 'start-logo' }, copy.appName),
      h('h1', { class: 'start-title' }, copy.startTitle),
      h('div', { class: 'choices' }, dropzone, drawChoice),
      h('p', { class: 'muted' }, copy.privacy),
      notice,
      input,
    ),
  );

  renderNotice(notice, store.getState().notice);
  const unsubscribe = store.subscribe((s) => renderNotice(notice, s.notice));
  return () => {
    unsubscribe();
    host.replaceChildren();
  };
};
