import { copy } from '../copy';
import { h } from '../dom';

export interface ConfirmDialogOptions {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** 확인·취소 어느 쪽으로든 창이 닫힌 뒤에 불린다 */
  onClose?: () => void;
}

/**
 * 되돌릴 수 없는 일을 하기 전에 한 번 더 묻는 창. 닫는 함수를 돌려준다.
 * 실수로 확인을 누르지 않도록 처음 포커스는 "취소"에 둔다. Esc와 창 바깥 클릭은 취소다.
 */
export function openConfirmDialog(opt: ConfirmDialogOptions): () => void {
  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let closed = false;

  const messageId = 'confirm-dialog-message';
  const cancelButton = h('button', { class: 'btn', type: 'button' }, copy.cancel);
  const confirmButton = h('button', { class: 'btn btn-primary', type: 'button' }, opt.confirmLabel);
  const dialog = h(
    'div',
    { class: 'confirm-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-describedby': messageId },
    h('p', { id: messageId, class: 'confirm-message' }, opt.message),
    h('div', { class: 'dialog-actions' }, cancelButton, confirmButton),
  );
  const backdrop = h('div', { class: 'modal-backdrop' }, dialog);

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    previouslyFocused?.focus();
    opt.onClose?.();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      // 버튼 두 개 사이에서만 포커스가 돈다
      e.preventDefault();
      (document.activeElement === cancelButton ? confirmButton : cancelButton).focus();
    }
  };
  document.addEventListener('keydown', onKey, true);

  cancelButton.addEventListener('click', close);
  confirmButton.addEventListener('click', () => {
    close();
    opt.onConfirm();
  });
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close();
  });

  document.body.append(backdrop);
  cancelButton.focus();
  return close;
}
