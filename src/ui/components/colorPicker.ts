import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, type Hsv } from '../../core/hsv';
import { copy } from '../copy';
import { h } from '../dom';

const SV_WIDTH = 240;
const SV_HEIGHT = 160;
const KEY_STEP = 0.02; // 방향키 한 번에 채도·명도가 움직이는 양(Shift는 5배)

export interface ColorPickerOptions {
  /** 지금 쓰고 있는 색(#rrggbb) */
  initial: string;
  /** 저장된 색 목록(가장 최근이 앞) */
  saved: readonly string[];
  /** "확인"을 눌렀을 때만 불린다 */
  onConfirm: (hex: string) => void;
  /** 확인·취소 어느 쪽으로든 창이 닫힌 뒤에 불린다 */
  onClose?: () => void;
}

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

/**
 * 색 선택 창을 열고, 창을 닫는 함수를 돌려준다.
 * 색을 골라도 바로 적용되지 않고 "확인"을 눌러야만 onConfirm이 불린다.
 * "취소", Esc, 창 바깥 클릭은 아무것도 바꾸지 않고 닫는다.
 */
export function openColorPicker(opt: ColorPickerOptions): () => void {
  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let hsv: Hsv = rgbToHsv(...(hexToRgb(opt.initial) ?? [0, 0, 0]));
  let closed = false;

  const currentHex = () => rgbToHex(...hsvToRgb(hsv.h, hsv.s, hsv.v));

  // ── 색 영역(채도·명도) ──
  const svCanvas = h('canvas', {
    class: 'sv-canvas',
    width: SV_WIDTH,
    height: SV_HEIGHT,
    tabindex: '0',
    role: 'application',
    'aria-label': copy.colorSv,
  });
  const svMarker = h('div', { class: 'sv-marker', 'aria-hidden': 'true' });
  const svCtx = svCanvas.getContext('2d');
  if (!svCtx) throw new Error('캔버스를 쓸 수 없어요');

  const drawSv = () => {
    const [r, g, b] = hsvToRgb(hsv.h, 1, 1);
    svCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    svCtx.fillRect(0, 0, SV_WIDTH, SV_HEIGHT);
    const white = svCtx.createLinearGradient(0, 0, SV_WIDTH, 0);
    white.addColorStop(0, 'rgba(255, 255, 255, 1)');
    white.addColorStop(1, 'rgba(255, 255, 255, 0)');
    svCtx.fillStyle = white;
    svCtx.fillRect(0, 0, SV_WIDTH, SV_HEIGHT);
    const black = svCtx.createLinearGradient(0, 0, 0, SV_HEIGHT);
    black.addColorStop(0, 'rgba(0, 0, 0, 0)');
    black.addColorStop(1, 'rgba(0, 0, 0, 1)');
    svCtx.fillStyle = black;
    svCtx.fillRect(0, 0, SV_WIDTH, SV_HEIGHT);
  };

  const pickSv = (e: PointerEvent) => {
    const rect = svCanvas.getBoundingClientRect();
    hsv = {
      h: hsv.h,
      s: clampUnit((e.clientX - rect.left) / rect.width),
      v: 1 - clampUnit((e.clientY - rect.top) / rect.height),
    };
    sync('sv');
  };
  let dragging = false;
  svCanvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    svCanvas.setPointerCapture(e.pointerId);
    svCanvas.focus();
    pickSv(e);
  });
  svCanvas.addEventListener('pointermove', (e) => {
    if (dragging) pickSv(e);
  });
  const stopDrag = () => {
    dragging = false;
  };
  svCanvas.addEventListener('pointerup', stopDrag);
  svCanvas.addEventListener('pointercancel', stopDrag);
  svCanvas.addEventListener('keydown', (e) => {
    const step = KEY_STEP * (e.shiftKey ? 5 : 1);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    hsv = { h: hsv.h, s: clampUnit(hsv.s + move[0]), v: clampUnit(hsv.v + move[1]) };
    sync('sv');
  });

  // ── 색상 슬라이더, 색 코드 ──
  const hueInput = h('input', { class: 'hue-slider', type: 'range', min: 0, max: 360, step: 1, 'aria-label': copy.colorHue });
  hueInput.addEventListener('input', () => {
    hsv = { ...hsv, h: Number(hueInput.value) };
    sync('hue');
  });

  const hexInput = h('input', {
    class: 'hex-input',
    type: 'text',
    maxlength: 7,
    spellcheck: 'false',
    autocomplete: 'off',
    'aria-label': copy.colorHex,
  });
  const hexError = h('p', { class: 'field-error is-hidden', role: 'alert' }, copy.colorHexInvalid);
  const confirmButton = h('button', { class: 'btn btn-primary', type: 'button' }, copy.confirm);
  const cancelButton = h('button', { class: 'btn', type: 'button' }, copy.cancel);

  const setInvalid = (invalid: boolean) => {
    hexInput.classList.toggle('is-invalid', invalid);
    hexInput.setAttribute('aria-invalid', String(invalid));
    hexError.classList.toggle('is-hidden', !invalid);
    confirmButton.toggleAttribute('disabled', invalid);
  };
  hexInput.addEventListener('input', () => {
    const typed = hexInput.value.trim();
    const rgb = hexToRgb(typed.startsWith('#') ? typed : `#${typed}`);
    if (!rgb) {
      setInvalid(true);
      return;
    }
    hsv = rgbToHsv(...rgb);
    sync('hex');
  });
  hexInput.addEventListener('blur', () => {
    if (hexInput.getAttribute('aria-invalid') === 'true') sync('init'); // 잘못 입력한 채로 떠나면 원래 색 코드로 되돌린다
  });

  // ── 이전 / 새 색, 저장된 색 ──
  // 화면에는 글자 없이 색 칸만 보이고, 이름은 툴팁과 스크린 리더용 접근성 이름으로만 남긴다
  const oldSwatch = h('span', {
    class: 'swatch large',
    role: 'img',
    'aria-label': `${copy.colorOld} ${opt.initial}`,
    title: `${copy.colorOld} ${opt.initial}`,
  });
  oldSwatch.style.backgroundColor = opt.initial;
  const newSwatch = h('span', { class: 'swatch large', role: 'img' });

  const savedButtons = opt.saved.map((hex) => {
    const button = h('button', {
      class: 'swatch swatch-btn',
      type: 'button',
      title: hex,
      'aria-label': `${copy.colorSavedItem} ${hex}`,
    });
    button.style.backgroundColor = hex;
    button.addEventListener('click', () => {
      const rgb = hexToRgb(hex);
      if (!rgb) return;
      hsv = rgbToHsv(...rgb);
      sync('saved');
    });
    return { hex, el: button };
  });
  const savedRow =
    savedButtons.length > 0
      ? h('div', { class: 'saved-colors' }, ...savedButtons.map((b) => b.el))
      : h('p', { class: 'muted' }, copy.colorSavedEmpty);

  // ── 화면 갱신 ──
  const sync = (from: 'sv' | 'hue' | 'hex' | 'saved' | 'init') => {
    const hex = currentHex();
    drawSv();
    svMarker.style.left = `${hsv.s * SV_WIDTH}px`;
    svMarker.style.top = `${(1 - hsv.v) * SV_HEIGHT}px`;
    if (from !== 'hue') hueInput.value = String(Math.round(hsv.h));
    if (from !== 'hex') {
      hexInput.value = hex;
      setInvalid(false);
    }
    newSwatch.style.backgroundColor = hex;
    newSwatch.title = `${copy.colorNew} ${hex}`;
    newSwatch.setAttribute('aria-label', `${copy.colorNew} ${hex}`);
    savedButtons.forEach((b) => b.el.setAttribute('aria-pressed', String(b.hex === hex)));
  };

  // ── 창 조립 ──
  const titleId = 'color-dialog-title';
  const dialog = h(
    'div',
    { class: 'color-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('h2', { id: titleId, class: 'dialog-title' }, copy.colorDialogTitle),
    h('div', { class: 'sv-wrap' }, svCanvas, svMarker),
    hueInput,
    h(
      'div',
      { class: 'color-values' },
      hexInput,
      h('div', { class: 'compare' }, oldSwatch, newSwatch),
    ),
    hexError,
    h('div', { class: 'saved-section' }, h('span', { class: 'label' }, copy.colorSaved), savedRow),
    h('div', { class: 'dialog-actions' }, cancelButton, confirmButton),
  );
  const backdrop = h('div', { class: 'modal-backdrop' }, dialog);

  // ── 닫기 ──
  const focusables = () =>
    [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input, canvas[tabindex]')];

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    previouslyFocused?.focus();
    opt.onClose?.();
  };
  const confirm = () => {
    if (confirmButton.hasAttribute('disabled')) return;
    const hex = currentHex();
    close();
    opt.onConfirm(hex);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter' && e.target === hexInput) {
      e.preventDefault();
      confirm();
    } else if (e.key === 'Tab') {
      // 창 안에서만 포커스가 돈다
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', onKey, true);

  confirmButton.addEventListener('click', confirm);
  cancelButton.addEventListener('click', close);
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close(); // 창 바깥을 누르면 취소
  });

  document.body.append(backdrop);
  sync('init');
  svCanvas.focus();
  return close;
}
