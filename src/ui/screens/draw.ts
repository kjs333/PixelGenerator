import { FREEHAND_SIZE, MAX_UNDO, MAX_UNDO_BYTES } from '../../config/constants';
import { createHistory } from '../../editor/history';
import { loadPenColor, savePenColor } from '../../io/preferences';
import { copy } from '../copy';
import { h } from '../dom';
import { readBuffer } from '../render';
import type { Screen } from './types';

type Tool = 'pen' | 'eraser';
type Point = { x: number; y: number };

/** 붓질 한 번으로 바뀐 사각형 영역의 전/후 픽셀. 캔버스 전체를 저장하지 않는다. */
interface Patch {
  x: number;
  y: number;
  before: ImageData;
  after: ImageData;
  bytes: number;
}

const PAPER = '#ffffff';
const MAX_DISPLAY_SCALE = 2; // 작은 캔버스를 화면에서 최대 2배까지 키워 보여 준다
const STAGE_PADDING = 32;
const MIN_CURSOR_DIAMETER = 4;

const TEXT_INPUT_TYPES = ['text', 'number', 'search', 'email', 'url', 'password', 'tel'];
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && TEXT_INPUT_TYPES.includes(target.type));

/**
 * 그림 화면: 빈 캔버스(512×512)에 그리거나, 올린 사진 위에 펜으로 덧그린다.
 * Day 2에 PixelEditor의 freehand 모드로 옮길 임시 구현이다(펜·지우개·색·굵기·실행 취소).
 */
export const drawScreen: Screen = (host, { store, actions }) => {
  const base = store.getState().source; // 있으면 사진 위에 덧그리기, 없으면 빈 캔버스

  const canvas = h('canvas', { class: 'draw-canvas' });
  canvas.width = base ? base.width : FREEHAND_SIZE;
  canvas.height = base ? base.height : FREEHAND_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('캔버스를 쓸 수 없어요');
  if (base) {
    ctx.putImageData(new ImageData(new Uint8ClampedArray(base.data), base.width, base.height), 0, 0);
  } else {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 마지막으로 확정된 상태의 복사본. 붓질이 끝나면 "바뀌기 전" 영역을 여기서 꺼낸다.
  const backup = document.createElement('canvas');
  backup.width = canvas.width;
  backup.height = canvas.height;
  const backupCtx = backup.getContext('2d', { willReadFrequently: true });
  if (!backupCtx) throw new Error('캔버스를 쓸 수 없어요');
  backupCtx.putImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);

  const history = createHistory<Patch>(MAX_UNDO, MAX_UNDO_BYTES);

  // 펜 굵기는 캔버스 픽셀 단위. 큰 사진에서도 쓸 만하게 긴 변에 비례해 기본값과 최대값을 정한다.
  const longSide = Math.max(canvas.width, canvas.height);
  const maxPen = Math.max(32, Math.round(longSide / 10));
  let size = Math.max(6, Math.round(longSide / 80));
  let tool: Tool = 'pen';
  let color = loadPenColor(); // 마지막에 고른 펜 색을 기억해 둔다
  let last: Point | null = null;
  let dirty: { x0: number; y0: number; x1: number; y1: number } | null = null;
  let scale = 1;

  const inkColor = () => (tool === 'eraser' ? PAPER : color);

  const pointOf = (e: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  // ── 커서: 펜 굵기만 한 원 ──
  const cursor = h('div', { class: 'pen-cursor is-hidden', 'aria-hidden': 'true' });
  const cursorDiameter = () => Math.max(MIN_CURSOR_DIAMETER, Math.round(size * scale));
  const sizeCursor = () => {
    const d = cursorDiameter();
    cursor.style.width = `${d}px`;
    cursor.style.height = `${d}px`;
  };
  const moveCursor = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const d = cursorDiameter();
    cursor.style.left = `${e.clientX - rect.left - d / 2}px`;
    cursor.style.top = `${e.clientY - rect.top - d / 2}px`;
  };

  // ── 그리기 ──
  const grow = (p: Point) => {
    const r = size / 2 + 2;
    dirty = dirty
      ? { x0: Math.min(dirty.x0, p.x - r), y0: Math.min(dirty.y0, p.y - r), x1: Math.max(dirty.x1, p.x + r), y1: Math.max(dirty.y1, p.y + r) }
      : { x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r };
  };

  const dot = (p: Point) => {
    ctx.fillStyle = inkColor();
    ctx.beginPath();
    ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    grow(p);
  };

  const line = (from: Point, to: Point) => {
    ctx.strokeStyle = inkColor();
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    grow(from);
    grow(to);
  };

  /** 붓질이 끝나면 바뀐 영역의 전/후만 기록에 남긴다. */
  const commitStroke = () => {
    last = null;
    if (!dirty) return;
    const x0 = Math.max(0, Math.floor(dirty.x0));
    const y0 = Math.max(0, Math.floor(dirty.y0));
    const w = Math.min(canvas.width, Math.ceil(dirty.x1)) - x0;
    const hgt = Math.min(canvas.height, Math.ceil(dirty.y1)) - y0;
    dirty = null;
    if (w <= 0 || hgt <= 0) return;

    const before = backupCtx.getImageData(x0, y0, w, hgt);
    const after = ctx.getImageData(x0, y0, w, hgt);
    backupCtx.putImageData(after, x0, y0);
    history.push({ x: x0, y: y0, before, after, bytes: w * hgt * 8 });
    syncHistoryButtons();
  };

  const apply = (patch: Patch, pixels: ImageData) => {
    ctx.putImageData(pixels, patch.x, patch.y);
    backupCtx.putImageData(pixels, patch.x, patch.y);
  };
  const undo = () => {
    const patch = history.undo();
    if (patch) apply(patch, patch.before);
    syncHistoryButtons();
  };
  const redo = () => {
    const patch = history.redo();
    if (patch) apply(patch, patch.after);
    syncHistoryButtons();
  };

  canvas.addEventListener('pointerenter', (e) => {
    cursor.classList.remove('is-hidden');
    moveCursor(e);
  });
  canvas.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || last) return;
    canvas.setPointerCapture(e.pointerId);
    last = pointOf(e);
    dot(last);
  });
  canvas.addEventListener('pointermove', (e) => {
    moveCursor(e);
    if (!last) return;
    const p = pointOf(e);
    line(last, p);
    last = p;
  });
  canvas.addEventListener('pointerup', commitStroke);
  canvas.addEventListener('pointercancel', commitStroke);

  // ── 도구 모음 ──
  const penButton = h('button', { class: 'btn tool', type: 'button', title: `${copy.drawPen} (B)` }, copy.drawPen);
  const eraserButton = h('button', { class: 'btn tool', type: 'button', title: `${copy.drawEraser} (E)` }, copy.drawEraser);
  const selectTool = (next: Tool) => {
    tool = next;
    penButton.setAttribute('aria-pressed', String(tool === 'pen'));
    eraserButton.setAttribute('aria-pressed', String(tool === 'eraser'));
  };
  penButton.addEventListener('click', () => selectTool('pen'));
  eraserButton.addEventListener('click', () => selectTool('eraser'));
  selectTool('pen');

  const colorInput = h('input', { type: 'color', value: color, 'aria-label': copy.drawColor });
  colorInput.addEventListener('input', () => {
    color = colorInput.value;
    savePenColor(color);
    selectTool('pen');
  });

  const sizeInput = h('input', { type: 'range', min: 1, max: maxPen, value: size, 'aria-label': copy.drawSize });
  sizeInput.addEventListener('input', () => {
    size = Number(sizeInput.value);
    sizeCursor();
  });

  const undoButton = h('button', { class: 'btn', type: 'button', title: `${copy.undo} (Ctrl+Z)` }, copy.undo);
  const redoButton = h('button', { class: 'btn', type: 'button', title: `${copy.redo} (Ctrl+Shift+Z)` }, copy.redo);
  undoButton.addEventListener('click', undo);
  redoButton.addEventListener('click', redo);
  const syncHistoryButtons = () => {
    undoButton.toggleAttribute('disabled', !history.canUndo());
    redoButton.toggleAttribute('disabled', !history.canRedo());
  };
  syncHistoryButtons();

  const onKey = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (last) return; // 그리는 중에는 되돌리지 않는다
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (e.key === 'b' || e.key === 'B') selectTool('pen');
    if (e.key === 'e' || e.key === 'E') selectTool('eraser');
  };
  document.addEventListener('keydown', onKey);

  const leave = h('button', { class: 'btn', type: 'button' }, base ? copy.cancelDrawing : copy.backToStart);
  leave.addEventListener('click', () => (base ? actions.cancelDrawing() : actions.goStart()));
  const next = h('button', { class: 'btn btn-primary', type: 'button' }, copy.toConvert);
  next.addEventListener('click', () => actions.useDrawing(readBuffer(canvas)));

  const stage = h('div', { class: 'draw-stage' }, h('div', { class: 'draw-canvas-wrap' }, canvas, cursor));

  host.append(
    h(
      'main',
      { class: 'screen draw' },
      h(
        'header',
        { class: 'draw-bar' },
        leave,
        h('div', { class: 'draw-tools' },
          penButton,
          eraserButton,
          h('label', { class: 'field' }, copy.drawColor, colorInput),
          h('label', { class: 'field' }, copy.drawSize, sizeInput),
          undoButton,
          redoButton,
        ),
        next,
      ),
      stage,
    ),
  );

  // 화면 크기에 맞춰 캔버스를 비율대로 보여 준다(펜 원도 같은 비율로 맞춘다)
  const layout = () => {
    const fit = Math.min(
      (stage.clientWidth - STAGE_PADDING) / canvas.width,
      (stage.clientHeight - STAGE_PADDING) / canvas.height,
    );
    scale = Math.max(0.01, Math.min(MAX_DISPLAY_SCALE, fit));
    canvas.style.width = `${Math.max(1, Math.floor(canvas.width * scale))}px`;
    canvas.style.height = `${Math.max(1, Math.floor(canvas.height * scale))}px`;
    sizeCursor();
  };
  layout();
  const observer = new ResizeObserver(layout);
  observer.observe(stage);

  return () => {
    observer.disconnect();
    document.removeEventListener('keydown', onKey);
    host.replaceChildren();
  };
};
