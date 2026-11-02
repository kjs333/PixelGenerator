import { EXPORT_SCALES } from '../../config/constants';
import type { PixelBuffer } from '../../core/types';
import { animationGif } from '../../io/exportPng';
import { copy } from '../copy';
import { h } from '../dom';
import { downloadIcon } from './icons';

export interface GifDialogOptions {
  frames: PixelBuffer[];
  /** 시트 미리보기에서 고른 속도. GIF도 이 속도로 돈다. */
  fps: number;
  onSave: (scale: number) => void;
  /** 저장·취소 어느 쪽으로든 창이 닫힌 뒤에 불린다 */
  onClose?: () => void;
}

const FOCUSABLE = 'button:not(:disabled), select:not(:disabled)';

/**
 * GIF 다운로드 창: 실제로 만든 GIF를 고른 배율의 실제 크기로 보여 주고, 배율을 골라 저장한다. 닫는 함수를 돌려준다.
 * 미리보기는 원래 크기 GIF 한 장을 칸이 흐려지지 않게 키워 보여 준다(확대 저장본과 모양이 같다).
 * Esc와 창 바깥 클릭은 취소다.
 */
export function openGifDialog(opt: GifDialogOptions): () => void {
  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let closed = false;
  const { width, height } = opt.frames[0]!;

  const previewUrl = URL.createObjectURL(animationGif(opt.frames, opt.fps, 1));
  const preview = h('img', {
    class: 'gif-preview checker',
    src: previewUrl,
    alt: copy.gifPreview,
  });
  // 미리보기 틀은 가장 큰 배율 크기로 고정한다. 배율을 바꿔도 창 크기가 흔들리지 않는다.
  const maxScale = Math.max(...EXPORT_SCALES);
  const stage = h('div', { class: 'gif-preview-stage' }, preview);
  stage.style.width = `${width * maxScale}px`;
  stage.style.height = `${height * maxScale}px`;

  // 배율 선택지에는 실제로 저장될 크기를 함께 보여 준다(예: "4배 (128×128)")
  const scaleSelect = h(
    'select',
    { class: 'select', 'aria-label': copy.exportScale },
    ...EXPORT_SCALES.map((scale) =>
      h(
        'option',
        { value: String(scale) },
        `${scale === 1 ? copy.exportScaleOriginal : `${scale}배`} (${width * scale}×${height * scale})`,
      ),
    ),
  );

  const titleId = 'gif-dialog-title';
  const cancelButton = h('button', { class: 'btn', type: 'button' }, copy.cancel);
  const saveButton = h(
    'button',
    { class: 'btn btn-primary btn-download', type: 'button', 'aria-label': copy.gifDialogTitle },
    downloadIcon(),
    copy.saveGif,
  );

  const dialog = h(
    'div',
    {
      class: 'confirm-dialog gif-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
    },
    h('h2', { id: titleId, class: 'dialog-title' }, copy.gifDialogTitle),
    h('div', { class: 'gif-preview-wrap' }, stage),
    h(
      'p',
      { class: 'dialog-note muted' },
      `${opt.frames.length}${copy.sheetFrame} · ${opt.fps} ${copy.fps} · ${copy.gifLoop}`,
    ),
    h(
      'label',
      { class: 'option-group' },
      h('span', { class: 'label' }, copy.exportScale),
      scaleSelect,
    ),
    h('p', { class: 'dialog-note muted' }, copy.gifNote),
    h('div', { class: 'dialog-actions' }, cancelButton, saveButton),
  );
  const backdrop = h('div', { class: 'modal-backdrop' }, dialog);

  /** 미리보기를 고른 배율의 실제 크기로 맞춘다. */
  const sync = () => {
    const scale = Number(scaleSelect.value);
    preview.width = width * scale;
    preview.height = height * scale;
  };

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    URL.revokeObjectURL(previewUrl);
    previouslyFocused?.focus();
    opt.onClose?.();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      // 창 안에서만 포커스가 돈다
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? index <= 0
          ? items.length - 1
          : index - 1
        : (index + 1) % items.length;
      e.preventDefault();
      items[next]!.focus();
    }
  };
  document.addEventListener('keydown', onKey, true);

  scaleSelect.addEventListener('change', sync);
  cancelButton.addEventListener('click', close);
  saveButton.addEventListener('click', () => {
    const scale = Number(scaleSelect.value);
    close();
    opt.onSave(scale);
  });
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close();
  });

  sync();
  document.body.append(backdrop);
  saveButton.focus();
  return close;
}
