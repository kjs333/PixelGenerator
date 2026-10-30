import {
  FREEHAND_SIZE,
  MAX_FREEHAND_ZOOM,
  MAX_PIXEL_BRUSH,
  MAX_PIXEL_ZOOM,
  MAX_SAVED_COLORS,
  MAX_UNDO,
  MAX_UNDO_BYTES,
  MIN_FREEHAND_ZOOM,
} from '../../config/constants';
import { rgbToHex } from '../../core/hsv';
import type { PixelBuffer } from '../../core/types';
import { brushOrigin, brushRect } from '../../editor/brush';
import { createHistory } from '../../editor/history';
import { linePoints } from '../../editor/line';
import { addRecentColor } from '../../editor/recentColors';
import {
  loadPenColor,
  loadSavedColors,
  parseHexColor,
  savePenColor,
  saveSavedColors,
} from '../../io/preferences';
import { copy } from '../copy';
import { h } from '../dom';
import { readBuffer } from '../render';
import { openColorPicker } from './colorPicker';

/**
 * freehand: 그림판처럼 자유롭게 그린다(둥근 붓, 부드러운 가장자리, 지우개는 흰색).
 * pixel: 칸 단위로 칠한다(N×N 정사각형 붓, 번짐 없음, 지우개는 투명).
 */
export type PaintMode = 'freehand' | 'pixel';

export interface PaintEditorOptions {
  mode: PaintMode;
  /** freehand: 있으면 그 이미지 위에 덧그리고, 없으면 흰 빈 캔버스. pixel: 필수(고칠 이미지). */
  base: PixelBuffer | null;
  /** 붓질, 실행 취소, 다시 실행으로 그림이 바뀐 뒤에 불린다 */
  onChange?: () => void;
  /** 펜 색이 바뀐 뒤에 불린다 */
  onColorChange?: (hex: string) => void;
}

export interface PaintEditor {
  /** 펜·지우개·색·크기·실행 취소 도구 모음 */
  toolbar: HTMLElement;
  /** 캔버스 영역 */
  stage: HTMLElement;
  /** 지금 그림을 읽는다 */
  getBuffer(): PixelBuffer;
  /** 지금 펜 색(#rrggbb) */
  getColor(): string;
  /** 펜 색을 바꾸고 펜 도구로 전환한다. 저장된 색 목록에는 넣지 않는다. */
  setColor(hex: string): void;
  /** 이벤트와 열려 있는 색 선택 창을 정리한다 */
  destroy(): void;
}

type Tool = 'pen' | 'eraser';
type Point = { x: number; y: number };
type Bounds = { x0: number; y0: number; x1: number; y1: number };

/** 붓질 한 번으로 바뀐 사각형 영역의 전/후 픽셀. 캔버스 전체를 저장하지 않는다. */
interface Patch {
  x: number;
  y: number;
  before: ImageData;
  after: ImageData;
  bytes: number;
}

const PAPER = '#ffffff';
const MAX_FREEHAND_SCALE = 2; // 작은 캔버스를 화면에서 최대 2배까지 키워 보여 준다
const STAGE_PADDING = 32;
const MIN_CURSOR_DIAMETER = 4;
const FREEHAND_ZOOM_STEP = 1.25; // Ctrl+휠 한 칸에 1.25배씩

const TEXT_INPUT_TYPES = ['text', 'number', 'search', 'email', 'url', 'password', 'tel'];
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && TEXT_INPUT_TYPES.includes(target.type));

const clampInt = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function createPaintEditor(opt: PaintEditorOptions): PaintEditor {
  const isPixel = opt.mode === 'pixel';
  const base = opt.base;
  if (isPixel && !base) throw new Error('칸 단위 수정에는 이미지가 필요해요');

  const canvas = h('canvas', { class: isPixel ? 'draw-canvas pixelated checker' : 'draw-canvas' });
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

  // freehand: 크기는 캔버스 픽셀 단위. 큰 사진에서도 쓸 만하게 긴 변에 비례해 기본값과 최대값을 정한다.
  // pixel: 크기는 N×N 칸. 기본 1×1.
  const longSide = Math.max(canvas.width, canvas.height);
  const maxSize = isPixel ? Math.min(MAX_PIXEL_BRUSH, longSide) : Math.max(32, Math.round(longSide / 10));
  let size = isPixel ? 1 : Math.max(6, Math.round(longSide / 80));
  let tool: Tool = 'pen';
  let color = loadPenColor(); // 마지막에 고른 펜 색을 기억해 둔다
  let last: Point | null = null;
  let dirty: Bounds | null = null;
  let scale = 1;
  let zoomed = false; // Ctrl+휠로 배율을 직접 정했으면 창 크기가 바뀌어도 화면 맞춤으로 되돌리지 않는다

  // ── 좌표 ──
  const pointOf = (e: MouseEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };
  /** 포인터가 가리키는 칸(pixel 모드). 이미지 밖은 가장자리 칸으로 맞춘다. */
  const cellOf = (e: MouseEvent): Point => {
    const p = pointOf(e);
    return {
      x: clampInt(Math.floor(p.x), 0, canvas.width - 1),
      y: clampInt(Math.floor(p.y), 0, canvas.height - 1),
    };
  };

  // ── 스포이드: 색 선택 창이 요청하면 창이 숨은 동안 그림을 한 번 클릭해 그 칸의 색을 고른다 ──
  let eyedrop: { pick: (hex: string) => void; cancel: () => void } | null = null;

  /** 클릭한 칸의 색(#rrggbb). 투명한 칸은 고를 색이 없으므로 null. */
  const colorUnder = (e: PointerEvent): string | null => {
    const cell = cellOf(e);
    const [r, g, b, a] = ctx.getImageData(cell.x, cell.y, 1, 1).data;
    return a === 0 ? null : rgbToHex(r!, g!, b!);
  };

  const startEyedrop = (onPick: (hex: string) => void, onCancel: () => void): (() => void) => {
    const hint = h('div', { class: 'eyedrop-hint', role: 'status' }, copy.eyedropperHint);
    const onOutside = (e: PointerEvent) => {
      if (e.target !== canvas) cancel(); // 그림 밖을 누르면 찍기를 취소하고 색 선택 창으로 돌아간다
    };
    const stop = () => {
      document.removeEventListener('pointerdown', onOutside, true);
      canvas.classList.remove('is-eyedropper');
      hint.remove();
      eyedrop = null;
    };
    const cancel = () => {
      if (!eyedrop) return;
      stop();
      onCancel();
    };
    eyedrop = {
      pick: (hex) => {
        stop();
        onPick(hex);
      },
      cancel,
    };
    canvas.classList.add('is-eyedropper');
    cursor.classList.add('is-hidden');
    document.body.append(hint);
    document.addEventListener('pointerdown', onOutside, true);
    return cancel;
  };

  // ── 커서: freehand는 펜 굵기만 한 원, pixel은 붓 영역에 맞춘 정사각형 ──
  const cursor = h('div', { class: `pen-cursor${isPixel ? ' is-square' : ''} is-hidden`, 'aria-hidden': 'true' });
  const cursorLength = () => (isPixel ? size * scale : Math.max(MIN_CURSOR_DIAMETER, Math.round(size * scale)));
  const sizeCursor = () => {
    const d = cursorLength();
    cursor.style.width = `${d}px`;
    cursor.style.height = `${d}px`;
  };
  const moveCursor = (e: MouseEvent) => {
    const d = cursorLength();
    if (isPixel) {
      const cell = cellOf(e);
      const { left, top } = brushOrigin(cell.x, cell.y, size);
      cursor.style.left = `${left * scale}px`;
      cursor.style.top = `${top * scale}px`;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    cursor.style.left = `${e.clientX - rect.left - d / 2}px`;
    cursor.style.top = `${e.clientY - rect.top - d / 2}px`;
  };

  // ── 그리기 ──
  const markDirty = (x0: number, y0: number, x1: number, y1: number) => {
    dirty = dirty
      ? { x0: Math.min(dirty.x0, x0), y0: Math.min(dirty.y0, y0), x1: Math.max(dirty.x1, x1), y1: Math.max(dirty.y1, y1) }
      : { x0, y0, x1, y1 };
  };

  // freehand
  const inkColor = () => (tool === 'eraser' ? PAPER : color);
  const dot = (p: Point) => {
    ctx.fillStyle = inkColor();
    ctx.beginPath();
    ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    const r = size / 2 + 2;
    markDirty(p.x - r, p.y - r, p.x + r, p.y + r);
  };
  const line = (from: Point, to: Point) => {
    ctx.strokeStyle = inkColor();
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    const r = size / 2 + 2;
    markDirty(Math.min(from.x, to.x) - r, Math.min(from.y, to.y) - r, Math.max(from.x, to.x) + r, Math.max(from.y, to.y) + r);
  };

  // pixel: 칸에 딱 맞는 사각형만 칠하므로 가장자리가 번지지 않는다. 지우개는 투명으로 만든다.
  const stamp = (cell: Point) => {
    const r = brushRect(cell.x, cell.y, size, canvas.width, canvas.height);
    if (!r) return;
    if (tool === 'eraser') {
      ctx.clearRect(r.x, r.y, r.w, r.h);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    markDirty(r.x, r.y, r.x + r.w, r.y + r.h);
  };
  const stampLine = (from: Point, to: Point) => {
    for (const p of linePoints(from.x, from.y, to.x, to.y)) stamp(p);
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
    opt.onChange?.();
  };

  const applyPatch = (patch: Patch, pixels: ImageData) => {
    ctx.putImageData(pixels, patch.x, patch.y);
    backupCtx.putImageData(pixels, patch.x, patch.y);
  };
  const undo = () => {
    const patch = history.undo();
    if (patch) applyPatch(patch, patch.before);
    syncHistoryButtons();
    if (patch) opt.onChange?.();
  };
  const redo = () => {
    const patch = history.redo();
    if (patch) applyPatch(patch, patch.after);
    syncHistoryButtons();
    if (patch) opt.onChange?.();
  };

  canvas.addEventListener('pointerenter', (e) => {
    if (eyedrop) return; // 스포이드로 찍는 중에는 붓 커서를 보여 주지 않는다
    cursor.classList.remove('is-hidden');
    moveCursor(e);
  });
  canvas.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (eyedrop) {
      // 찍는 중에는 칠하지 않고 클릭한 칸의 색만 고른다(투명한 칸이면 계속 기다린다)
      const hex = colorUnder(e);
      if (hex) eyedrop.pick(hex);
      return;
    }
    if (last) return;
    canvas.setPointerCapture(e.pointerId);
    if (isPixel) {
      last = cellOf(e);
      stamp(last);
    } else {
      last = pointOf(e);
      dot(last);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!eyedrop) moveCursor(e);
    if (!last) return;
    if (isPixel) {
      const cell = cellOf(e);
      if (cell.x === last.x && cell.y === last.y) return;
      stampLine(last, cell);
      last = cell;
    } else {
      const p = pointOf(e);
      line(last, p);
      last = p;
    }
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

  // 색 칸을 누르면 색 선택 창이 열린다. 창에서 "확인"을 눌렀을 때만 펜 색이 바뀌고, 그 색이 저장된 색 목록에 남는다.
  let savedColors = loadSavedColors();
  let closePicker: (() => void) | null = null;
  const colorSwatch = h('span', { class: 'swatch', 'aria-hidden': 'true' });
  const colorButton = h(
    'button',
    { class: 'btn color-btn', type: 'button', 'aria-label': copy.drawColorOpen, 'aria-haspopup': 'dialog' },
    colorSwatch,
  );
  const showColor = () => {
    colorSwatch.style.backgroundColor = color;
    colorButton.title = `${copy.drawColor} ${color}`;
  };
  showColor();
  const changeColor = (hex: string) => {
    color = hex;
    savePenColor(hex);
    showColor();
    selectTool('pen');
    opt.onColorChange?.(hex);
  };
  colorButton.addEventListener('click', () => {
    if (closePicker) return;
    closePicker = openColorPicker({
      initial: color,
      saved: savedColors,
      onConfirm: (hex) => {
        savedColors = addRecentColor(savedColors, hex, MAX_SAVED_COLORS);
        saveSavedColors(savedColors);
        changeColor(hex);
      },
      onClose: () => {
        closePicker = null;
      },
      startEyedrop,
    });
  });

  const sizeInput = h('input', {
    type: 'range',
    min: 1,
    max: maxSize,
    value: size,
    'aria-label': isPixel ? copy.brushSize : copy.drawSize,
  });
  const sizeOutput = h('output', { class: 'value' }, isPixel ? `${size}×${size}` : '');
  sizeInput.addEventListener('input', () => {
    size = Number(sizeInput.value);
    if (isPixel) sizeOutput.textContent = `${size}×${size}`;
    sizeCursor();
  });

  const undoButton = h('button', { class: 'btn', type: 'button', title: `${copy.undo} (Ctrl+Z)` }, copy.undo);
  const redoButton = h('button', { class: 'btn', type: 'button', title: `${copy.redo} (Ctrl+Shift+Z)` }, copy.redo);
  const fitButton = h('button', { class: 'btn', type: 'button', title: `${copy.fitView} (Ctrl+F)` }, copy.fitView);
  undoButton.addEventListener('click', undo);
  redoButton.addEventListener('click', redo);
  fitButton.addEventListener('click', () => fitView());
  const syncHistoryButtons = () => {
    undoButton.toggleAttribute('disabled', !history.canUndo());
    redoButton.toggleAttribute('disabled', !history.canRedo());
  };
  syncHistoryButtons();

  const onKey = (e: KeyboardEvent) => {
    if (closePicker || isTyping(e.target)) return; // 색 선택 창이 열려 있으면 그림 단축키는 쓰지 않는다
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault(); // 브라우저 찾기 창 대신 화면 맞춤
        fitView();
        return;
      }
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

  const toolbar = h(
    'div',
    { class: 'draw-tools' },
    penButton,
    eraserButton,
    h('span', { class: 'field' }, copy.drawColor, colorButton),
    h('label', { class: 'field' }, isPixel ? copy.brushSize : copy.drawSize, sizeInput, sizeOutput),
    undoButton,
    redoButton,
    fitButton,
  );
  const stage = h('div', { class: 'draw-stage' }, h('div', { class: 'draw-canvas-wrap' }, canvas, cursor));

  const applyScale = (next: number) => {
    scale = next;
    canvas.style.width = `${Math.max(1, Math.floor(canvas.width * scale))}px`;
    canvas.style.height = `${Math.max(1, Math.floor(canvas.height * scale))}px`;
    sizeCursor();
  };

  // 화면 크기에 맞춰 캔버스를 보여 준다(커서도 같은 비율로 맞춘다).
  // freehand: 비율대로 최대 2배까지. pixel: 칸이 또렷하도록 정수 배율만.
  const layout = () => {
    if (zoomed) return;
    const fit = Math.min(
      (stage.clientWidth - STAGE_PADDING) / canvas.width,
      (stage.clientHeight - STAGE_PADDING) / canvas.height,
    );
    applyScale(
      isPixel ? clampInt(Math.floor(fit), 1, MAX_PIXEL_ZOOM) : Math.max(0.01, Math.min(MAX_FREEHAND_SCALE, fit)),
    );
  };
  layout();
  const observer = new ResizeObserver(layout);
  /** Ctrl+휠로 바꾼 배율을 버리고 다시 화면에 맞춘다. */
  function fitView() {
    zoomed = false;
    layout();
    stage.scrollLeft = 0;
    stage.scrollTop = 0;
  }
  observer.observe(stage);

  // Ctrl+휠: 마우스가 가리키는 곳을 기준으로 확대·축소한다(브라우저 페이지 확대는 막는다).
  // pixel은 칸이 또렷하도록 정수 배율로만 움직인다.
  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    if (e.deltaY === 0) return;
    const zoomIn = e.deltaY < 0;
    const next = isPixel
      ? clampInt(scale + (zoomIn ? 1 : -1) * Math.max(1, Math.round(scale / 8)), 1, MAX_PIXEL_ZOOM)
      : Math.min(MAX_FREEHAND_ZOOM, Math.max(MIN_FREEHAND_ZOOM, zoomIn ? scale * FREEHAND_ZOOM_STEP : scale / FREEHAND_ZOOM_STEP));
    if (next === scale) return;

    // 바꾸기 전에 마우스 아래에 있던 캔버스 지점이 바꾼 뒤에도 마우스 아래에 오도록 스크롤을 옮긴다
    const before = canvas.getBoundingClientRect();
    const ax = (e.clientX - before.left) / scale;
    const ay = (e.clientY - before.top) / scale;
    zoomed = true;
    applyScale(next);
    const after = canvas.getBoundingClientRect();
    stage.scrollLeft += after.left + ax * scale - e.clientX;
    stage.scrollTop += after.top + ay * scale - e.clientY;
    if (!cursor.classList.contains('is-hidden')) moveCursor(e);
  };
  stage.addEventListener('wheel', onWheel, { passive: false });

  return {
    toolbar,
    stage,
    getBuffer: () => readBuffer(canvas),
    getColor: () => color,
    setColor(hex) {
      const valid = parseHexColor(hex);
      if (valid) changeColor(valid);
    },
    destroy() {
      closePicker?.();
      observer.disconnect();
      stage.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKey);
    },
  };
}
