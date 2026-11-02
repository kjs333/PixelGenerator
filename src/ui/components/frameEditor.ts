import type { PixelBuffer } from '../../core/types';
import { copy } from '../copy';
import { h } from '../dom';
import { createPaintEditor } from './paintEditor';
import { createUsedColors } from './usedColors';

export interface FrameEditorOptions {
  image: PixelBuffer;
  /** 화면에 보이는 프레임 번호(1부터) */
  number: number;
  onApply: (image: PixelBuffer) => void;
  /** 적용·취소 어느 쪽으로든 창이 닫힌 뒤에 불린다 */
  onClose?: () => void;
}

/**
 * 시트에서 프레임 하나를 고치는 창. 도구는 결과 수정과 같은 paintEditor(칸 단위)를 쓴다.
 * "적용"을 눌러야만 프레임에 반영된다. 고친 내용을 잃지 않도록 Esc나 바깥 클릭으로는 닫지 않는다.
 * 닫는 함수를 돌려준다.
 */
export function openFrameEditor(opt: FrameEditorOptions): () => void {
  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let closed = false;

  const usedColors = createUsedColors(() => editor);
  const editor = createPaintEditor({
    mode: 'pixel',
    base: opt.image,
    onChange: usedColors.render,
    onColorChange: usedColors.syncPressed,
  });
  usedColors.render();

  const titleId = 'frame-editor-title';
  const cancel = h('button', { class: 'btn', type: 'button' }, copy.editCancel);
  const apply = h('button', { class: 'btn btn-primary', type: 'button' }, copy.editApply);

  const dialog = h(
    'div',
    { class: 'frame-editor', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h(
      'header',
      { class: 'draw-bar' },
      h(
        'h2',
        { id: titleId, class: 'dialog-title' },
        `${copy.frameEditTitle} · ${copy.sheetFrame} ${opt.number}`,
      ),
      editor.toolbar,
      h('div', { class: 'dialog-actions' }, cancel, apply),
    ),
    h('div', { class: 'edit-body' }, usedColors.element, editor.stage),
  );
  const backdrop = h('div', { class: 'modal-backdrop' }, dialog);

  const close = () => {
    if (closed) return;
    closed = true;
    editor.destroy();
    backdrop.remove();
    previouslyFocused?.focus();
    opt.onClose?.();
  };

  cancel.addEventListener('click', close);
  apply.addEventListener('click', () => {
    const image = editor.getBuffer();
    close();
    opt.onApply(image);
  });

  document.body.append(backdrop);
  apply.focus();
  return close;
}
