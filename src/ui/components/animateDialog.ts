import { ANIMATION_FRAME_COUNTS, MAX_ACTION_LENGTH } from '../../config/constants';
import {
  checkAnimationRequest,
  fitsAnimationLimit,
  formatAmount,
  type AnimationFrameCount,
} from '../../core/animation';
import { fetchPixellabBalance, type PixellabBalance } from '../../io/pixellab';
import { copy } from '../copy';
import { h } from '../dom';

export interface AnimateDialogOptions {
  /** 보낼 그림 크기. 이 크기로 만들 수 없는 프레임 수는 고를 수 없다. */
  width: number;
  height: number;
  /** 처음에 채워 둘 값(지난번 요청) */
  action: string;
  frameCount: AnimationFrameCount;
  transparent: boolean;
  enhance: boolean;
  onSubmit: (request: {
    action: string;
    frameCount: AnimationFrameCount;
    transparent: boolean;
    enhance: boolean;
  }) => void;
  /** 보내기·취소 어느 쪽으로든 창이 닫힌 뒤에 불린다 */
  onClose?: () => void;
}

/** 예: "남은 생성분 12 / 50 · 크레딧 $3.2". 받지 못한 값은 빼고, 둘 다 없으면 null. */
function balanceText(balance: PixellabBalance): string | null {
  const parts = [
    balance.generations !== null
      ? `${copy.balanceGenerations} ${formatAmount(balance.generations)}${balance.total !== null ? ` / ${formatAmount(balance.total)}` : ''}`
      : null,
    balance.usd !== null ? `${copy.balanceCredits} $${formatAmount(balance.usd)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)';

/**
 * 애니메이션 생성 창: 동작 설명, 프레임 수, 투명 배경, 설명 늘리기를 고르고, 외부 전송 안내를 본 뒤 보낸다. 닫는 함수를 돌려준다.
 * 창이 열리면 Pixellab 잔액(남은 생성분, 크레딧)을 자동으로 조회해서 보내기 버튼 위에 보여 준다.
 * Esc와 창 바깥 클릭은 취소다. 동작 설명 칸에서 Enter는 보내기, Shift+Enter는 줄바꿈이다.
 */
export function openAnimateDialog(opt: AnimateDialogOptions): () => void {
  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let closed = false;

  const allowed = ANIMATION_FRAME_COUNTS.filter((n) =>
    fitsAnimationLimit(opt.width, opt.height, n),
  );
  let frameCount: AnimationFrameCount = allowed.includes(opt.frameCount)
    ? opt.frameCount
    : (allowed.at(-1) ?? opt.frameCount);

  const titleId = 'animate-dialog-title';
  const hintId = 'animate-dialog-hint';
  const actionInput = h('textarea', {
    class: 'text-input action-input',
    rows: 3,
    maxlength: MAX_ACTION_LENGTH,
    placeholder: copy.animateActionPlaceholder,
    'aria-label': copy.animateAction,
    'aria-describedby': hintId,
    id: 'animate-dialog-action',
  });
  actionInput.value = opt.action;

  const frameButtons = ANIMATION_FRAME_COUNTS.map((n) => {
    const fits = allowed.includes(n);
    const el = h(
      'button',
      {
        class: 'btn seg',
        type: 'button',
        disabled: !fits,
        title: fits ? undefined : copy.animateFramesTooMany,
      },
      String(n),
    );
    el.addEventListener('click', () => {
      frameCount = n;
      sync();
    });
    return { n, el };
  });

  const transparentInput = h('input', { type: 'checkbox' });
  transparentInput.checked = opt.transparent;
  const enhanceInput = h('input', { type: 'checkbox' });
  enhanceInput.checked = opt.enhance;

  const balanceInfo = h('p', { class: 'balance-info', role: 'status' }, copy.balanceLoading);

  const cancelButton = h('button', { class: 'btn', type: 'button' }, copy.cancel);
  const submitButton = h(
    'button',
    { class: 'btn btn-primary', type: 'button' },
    copy.animateSubmit,
  );

  const dialog = h(
    'div',
    {
      class: 'confirm-dialog animate-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
    },
    h('h2', { id: titleId, class: 'dialog-title' }, copy.animateDialogTitle),
    h(
      'div',
      { class: 'dialog-field' },
      h('label', { class: 'label', for: 'animate-dialog-action' }, copy.animateAction),
      actionInput,
      h(
        'div',
        { id: hintId, class: 'field-hint muted' },
        h('p', {}, copy.animateActionHint),
        h('p', { class: 'field-example' }, copy.animateActionExample),
      ),
    ),
    h(
      'div',
      { class: 'dialog-field' },
      h('span', { class: 'label' }, copy.animateFrames),
      h(
        'div',
        { class: 'seg-group', role: 'group', 'aria-label': copy.animateFrames },
        ...frameButtons.map((b) => b.el),
      ),
    ),
    h(
      'label',
      { class: 'option-group check', title: copy.animateTransparentTip },
      transparentInput,
      copy.animateTransparent,
    ),
    h('label', { class: 'option-group check' }, enhanceInput, copy.animateEnhance),
    h('p', { class: 'dialog-note muted' }, copy.animateEnhanceTip),
    h('p', { class: 'dialog-note muted' }, `ℹ ${copy.animateConsent} (${opt.width}×${opt.height})`),
    balanceInfo,
    h('div', { class: 'dialog-actions' }, cancelButton, submitButton),
  );
  const backdrop = h('div', { class: 'modal-backdrop' }, dialog);

  const isValid = () =>
    checkAnimationRequest({
      width: opt.width,
      height: opt.height,
      frameCount,
      action: actionInput.value,
    }) === null;

  function sync() {
    frameButtons.forEach(({ n, el }) => el.setAttribute('aria-pressed', String(n === frameCount)));
    submitButton.toggleAttribute('disabled', !isValid());
  }

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    previouslyFocused?.focus();
    opt.onClose?.();
  };

  const submit = () => {
    if (!isValid()) return;
    const action = actionInput.value.trim();
    close();
    opt.onSubmit({
      action,
      frameCount,
      transparent: transparentInput.checked,
      enhance: enhanceInput.checked,
    });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target === actionInput) {
      e.preventDefault();
      submit();
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

  actionInput.addEventListener('input', sync);
  cancelButton.addEventListener('click', close);
  submitButton.addEventListener('click', submit);
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close();
  });

  // 잔액은 창을 연 뒤 자동으로 조회한다. 창을 닫은 뒤에 온 응답은 버린다.
  fetchPixellabBalance()
    .then((balance) => {
      if (!closed) balanceInfo.textContent = balanceText(balance) ?? copy.balanceFailed;
    })
    .catch(() => {
      if (!closed) balanceInfo.textContent = copy.balanceFailed;
    });

  sync();
  document.body.append(backdrop);
  actionInput.focus();
  actionInput.select();
  return close;
}
