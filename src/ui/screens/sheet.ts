import { DEFAULT_FPS, MAX_FPS, MIN_FPS, SHEET_COLUMNS } from '../../config/constants';
import { formatAmount, type AnimationCost, type UsageCost } from '../../core/animation';
import { sheetLayout } from '../../core/spritesheet';
import type { PixelBuffer } from '../../core/types';
import type { AppState } from '../../state/store';
import { openAnimateDialog } from '../components/animateDialog';
import { openFrameEditor } from '../components/frameEditor';
import { openGifDialog } from '../components/gifDialog';
import { downloadIcon } from '../components/icons';
import { renderNotice } from '../components/notice';
import { topBar } from '../components/topBar';
import { copy } from '../copy';
import { h } from '../dom';
import { drawBuffer } from '../render';
import type { Screen } from './types';

const MAX_ZOOM = 32;

const formatElapsed = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const formatCost = (cost: UsageCost) =>
  cost.unit === 'usd'
    ? `$${formatAmount(cost.amount)}`
    : `${formatAmount(cost.amount)} ${copy.costUnitGenerations}`;

/** 예: "이번 요청 비용: 생성 1 생성분 + 설명 늘리기 0.05 생성분". 설명 늘리기는 요청했을 때만 붙인다. */
const costText = (cost: AnimationCost, enhanceRequested: boolean) => {
  const parts = [
    `${copy.costGeneration} ${cost.generation ? formatCost(cost.generation) : copy.costUnknown}`,
  ];
  if (enhanceRequested)
    parts.push(
      cost.enhance ? `${copy.costEnhance} ${formatCost(cost.enhance)}` : copy.costEnhanceFree,
    );
  return `${copy.costTitle}: ${parts.join(' + ')}`;
};

/** 칸이 또렷하도록 정수 배율로만 맞춘다. */
const integerFit = (availableW: number, availableH: number, w: number, h: number) =>
  Math.min(MAX_ZOOM, Math.max(1, Math.floor(Math.min(availableW / w, availableH / h))));

interface FrameList {
  buttons: { button: HTMLButtonElement; canvas: HTMLCanvasElement }[];
  /** 프레임 수가 바뀌면 버튼을 다시 만들고, 바뀐 프레임만 다시 그린다. 버튼을 다시 만들었으면 true. */
  render(frames: PixelBuffer[]): boolean;
}

/** 프레임마다 캔버스 버튼 하나. 시트 격자와 미리보기 아래 줄이 같이 쓴다. */
function createFrameList(
  container: HTMLElement,
  opt: { itemClass: string; label: (n: number) => string; onClick: (index: number) => void },
): FrameList {
  const list: FrameList = { buttons: [], render };
  let drawn: PixelBuffer[] = [];

  function render(frames: PixelBuffer[]): boolean {
    const rebuilt = list.buttons.length !== frames.length;
    if (rebuilt) {
      list.buttons = frames.map((_, i) => {
        const canvas = h('canvas', { class: 'view-canvas pixelated' });
        const button = h(
          'button',
          {
            class: opt.itemClass,
            type: 'button',
            title: opt.label(i + 1),
            'aria-label': opt.label(i + 1),
          },
          canvas,
          h('span', { class: 'sheet-frame-number', 'aria-hidden': 'true' }, String(i + 1)),
        );
        button.addEventListener('click', () => opt.onClick(i));
        return { button, canvas };
      });
      container.replaceChildren(...list.buttons.map((b) => b.button));
      drawn = [];
    }
    frames.forEach((frame, i) => {
      if (drawn[i] !== frame) drawBuffer(list.buttons[i]!.canvas, frame);
    });
    drawn = frames;
    return rebuilt;
  }

  return list;
}

/**
 * 스프라이트 시트 화면.
 * 위: 애니메이션에 쓴 픽셀 결과와 "다시 애니메이션 생성". 설명은 버튼을 누르면 말풍선으로 본다.
 * 만드는 중에는 아래 영역 대신 경과 시간 안내만 가운데에 보여 준다.
 * 왼쪽: 시트 전체(프레임 격자, 누르면 편집 창).
 * 오른쪽: 미리보기. 매 프레임 상태에서 프레임을 읽으므로 고친 프레임이 바로 재생에 반영된다.
 *   아래에 프레임이 순서대로 작게 나오고, 누르면 재생을 멈추고 그 프레임을 크게 보여 준다.
 */
export const sheetScreen: Screen = (host, { store, actions }) => {
  if (!store.getState().animation) {
    queueMicrotask(() => actions.backToConvert());
    return () => host.replaceChildren();
  }

  const bar = topBar(actions);

  // ── 위: 애니메이션에 쓴 픽셀 결과 ──
  const sourceCanvas = h('canvas', { class: 'source-thumb pixelated' });
  const sourceInfo = h('p', { class: 'source-info muted' });
  const costInfo = h('p', { class: 'source-info muted' });

  // 설명은 길어서 버튼을 눌렀을 때만 말풍선으로 보여 준다. 한 번에 하나만 열린다.
  const descriptionTip = (id: string, label: string, title: string) => {
    const button = h(
      'button',
      { class: 'btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': id },
      label,
    );
    const text = h('p', {});
    const tip = h(
      'div',
      { class: 'tooltip description-tip is-hidden', id, role: 'region', 'aria-label': title },
      h('strong', {}, title),
      text,
    );
    const wrap = h('span', { class: 'info' }, button, tip);
    const setOpen = (open: boolean) => {
      tip.classList.toggle('is-hidden', !open);
      button.setAttribute('aria-expanded', String(open));
    };
    return { button, text, tip, wrap, setOpen, isOpen: () => !tip.classList.contains('is-hidden') };
  };
  const actionTip = descriptionTip('action-description', copy.animateAction, copy.animateAction);
  const enhancedTip = descriptionTip(
    'enhanced-description',
    copy.enhancedPromptButton,
    copy.enhancedPrompt,
  );
  const tips = [actionTip, enhancedTip];
  tips.forEach((tip) =>
    tip.button.addEventListener('click', () => {
      const open = !tip.isOpen();
      tips.forEach((other) => other.setOpen(other === tip && open));
    }),
  );
  const onDocumentClick = (e: MouseEvent) => {
    if (!(e.target instanceof Node)) return;
    tips.forEach((tip) => {
      if (!tip.wrap.contains(e.target as Node)) tip.setOpen(false);
    });
  };
  const onDocumentKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    const open = tips.find((tip) => tip.isOpen());
    if (!open) return;
    open.setOpen(false);
    open.button.focus();
  };
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKey);
  const descriptions = h('div', { class: 'source-descriptions' }, actionTip.wrap, enhancedTip.wrap);
  let closeDialog: (() => void) | null = null;
  const regenerateButton = h(
    'button',
    { class: 'btn btn-primary', type: 'button' },
    copy.regenerateAnimation,
  );
  regenerateButton.addEventListener('click', () => {
    const animation = store.getState().animation;
    if (!animation || closeDialog) return;
    closeDialog = openAnimateDialog({
      width: animation.source.width,
      height: animation.source.height,
      action: animation.action,
      frameCount: animation.frameCount,
      transparent: animation.transparent,
      enhance: animation.enhance,
      onSubmit: (request) => void actions.generateAnimation(request, 'previous'),
      onClose: () => {
        closeDialog = null;
      },
    });
  });
  const sourceBar = h(
    'section',
    { class: 'animation-source', 'aria-label': copy.animationSource },
    h('div', { class: 'source-thumb-wrap' }, sourceCanvas),
    h(
      'div',
      { class: 'source-text' },
      h('strong', {}, copy.animationSource),
      sourceInfo,
      costInfo,
      descriptions,
    ),
    regenerateButton,
  );

  const notice = h('p', { class: 'notice', role: 'alert' });

  // ── 왼쪽: 시트 전체 ──
  const elapsed = h('span', {});
  const waiting = h(
    'div',
    { class: 'sheet-waiting', role: 'status' },
    h('span', { class: 'spinner', 'aria-hidden': 'true' }),
    h('p', {}, copy.animationWaiting),
    h('p', { class: 'muted' }, `${copy.animationElapsed} `, elapsed),
  );
  const empty = h('p', { class: 'empty muted' }, copy.animationEmpty);
  const grid = h('div', { class: 'sheet-grid' });
  // 만드는 중에는 시트·미리보기 대신 이 안내만 가운데에 보인다
  const waitingArea = h('div', { class: 'sheet-waiting-area' }, waiting);
  const sheetWrap = h('div', { class: 'canvas-wrap sheet-wrap' }, empty, grid);
  const sheetInfo = h('p', { class: 'sheet-info muted' });

  // 저장: 직접 고친 프레임까지 그대로 저장한다. 버튼은 "형식 이름 + 다운로드 아이콘".
  const downloadButton = (label: string, tip: string) =>
    h(
      'button',
      { class: 'btn btn-download', type: 'button', title: tip, 'aria-label': `${label} ${copy.download}` },
      label,
      downloadIcon(),
    );
  const saveSheetButton = downloadButton(copy.saveSheet, copy.saveSheetTip);
  saveSheetButton.addEventListener('click', () => void actions.exportAnimation('sheet'));
  const saveZipButton = downloadButton(copy.saveZip, copy.saveZipTip);
  saveZipButton.addEventListener('click', () => void actions.exportAnimation('zip'));
  // GIF는 미리보기와 저장 배율을 고르는 창을 먼저 띄운다. 속도는 오른쪽 미리보기의 FPS를 따른다.
  let closeGif: (() => void) | null = null;
  const saveGifButton = downloadButton(copy.saveGif, copy.saveGifTip);
  saveGifButton.addEventListener('click', () => {
    const frames = store.getState().animation?.frames;
    if (!frames || frames.length === 0 || closeGif) return;
    const gifFps = fps;
    closeGif = openGifDialog({
      frames,
      fps: gifFps,
      onSave: (scale) => actions.exportGif(gifFps, scale),
      onClose: () => {
        closeGif = null;
      },
    });
  });

  let closeEditor: (() => void) | null = null;

  const openEditor = (index: number) => {
    const frame = store.getState().animation?.frames[index];
    if (!frame || closeEditor) return;
    closeEditor = openFrameEditor({
      image: frame,
      number: index + 1,
      onApply: (image) => actions.updateFrame(index, image),
      onClose: () => {
        closeEditor = null;
      },
    });
  };

  const gridList = createFrameList(grid, {
    itemClass: 'sheet-frame',
    label: (n) => `${copy.sheetFrame} ${n} · ${copy.sheetFrameEdit}`,
    onClick: openEditor,
  });

  const layoutGrid = () => {
    const frames = store.getState().animation?.frames ?? [];
    if (frames.length === 0) return;
    const { columns, rows } = sheetLayout(
      frames[0]!.width,
      frames[0]!.height,
      frames.length,
      SHEET_COLUMNS,
    );
    grid.style.gridTemplateColumns = `repeat(${columns}, auto)`;
    const scale = integerFit(
      sheetWrap.clientWidth - 2 * columns,
      sheetWrap.clientHeight - 2 * rows,
      frames[0]!.width * columns,
      frames[0]!.height * rows,
    );
    gridList.buttons.forEach(({ canvas }) => {
      canvas.style.width = `${frames[0]!.width * scale}px`;
      canvas.style.height = `${frames[0]!.height * scale}px`;
    });
  };

  // ── 오른쪽: 미리보기 ──
  const previewCanvas = h('canvas', { class: 'view-canvas pixelated' });
  const previewWrap = h('div', { class: 'canvas-wrap' }, previewCanvas);
  const playButton = h('button', { class: 'btn', type: 'button' });
  const fpsInput = h('input', {
    type: 'range',
    min: MIN_FPS,
    max: MAX_FPS,
    'aria-label': copy.fps,
  });
  const fpsValue = h('output', { class: 'value' });
  const strip = h('div', {
    class: 'preview-strip',
    role: 'group',
    'aria-label': copy.previewStrip,
  });
  const previewControls = h(
    'div',
    { class: 'preview-controls' },
    playButton,
    h(
      'label',
      { class: 'option-group' },
      h('span', { class: 'label' }, copy.fps),
      fpsInput,
      fpsValue,
    ),
  );

  let playing = true;
  let fps = DEFAULT_FPS;
  let index = 0;
  let lastStep = 0;
  let drawnPreview: PixelBuffer | null = null;
  fpsInput.value = String(fps);

  const syncPlayback = () => {
    playButton.textContent = playing ? `❚❚ ${copy.pause}` : `▶ ${copy.play}`;
    playButton.setAttribute('aria-pressed', String(playing));
    fpsValue.textContent = String(fps);
  };
  playButton.addEventListener('click', () => {
    playing = !playing;
    syncPlayback();
  });
  fpsInput.addEventListener('input', () => {
    fps = Number(fpsInput.value);
    syncPlayback();
  });
  syncPlayback();

  /** 아래 줄에서 누른 프레임을 크게 본다. 그 프레임에서 멈춘다. */
  const showFrame = (i: number) => {
    playing = false;
    index = i;
    syncPlayback();
  };
  const stripList = createFrameList(strip, {
    itemClass: 'strip-frame',
    label: (n) => `${copy.sheetFrame} ${n} · ${copy.previewStripShow}`,
    onClick: showFrame,
  });

  /** 지금 미리보기에 나온 프레임을 시트 격자와 아래 줄에 표시한다 */
  let marked = -1;
  const markCurrent = () => {
    marked = index;
    gridList.buttons.forEach((f, i) => f.button.classList.toggle('is-playing', i === index));
    stripList.buttons.forEach((f, i) => {
      f.button.classList.toggle('is-playing', i === index);
      f.button.setAttribute('aria-pressed', String(i === index));
    });
  };

  const layoutPreview = () => {
    if (!drawnPreview) return;
    const scale = integerFit(
      previewWrap.clientWidth,
      previewWrap.clientHeight,
      drawnPreview.width,
      drawnPreview.height,
    );
    previewCanvas.style.width = `${drawnPreview.width * scale}px`;
    previewCanvas.style.height = `${drawnPreview.height * scale}px`;
  };

  // 매 화면 갱신마다 상태의 프레임을 읽는다. 고친 프레임은 배열 안의 객체가 바뀌므로 바로 다시 그려진다.
  let rafId = 0;
  const tick = (time: number) => {
    rafId = requestAnimationFrame(tick);
    const animation = store.getState().animation;
    const frames = animation && animation.startedAt === null ? animation.frames : [];
    if (frames.length === 0) return;
    if (playing && time - lastStep >= 1000 / fps) {
      index = (index + 1) % frames.length;
      lastStep = time;
    }
    index %= frames.length;
    const frame = frames[index]!;
    if (frame !== drawnPreview) {
      const resized =
        !drawnPreview || drawnPreview.width !== frame.width || drawnPreview.height !== frame.height;
      drawBuffer(previewCanvas, frame);
      drawnPreview = frame;
      if (resized) layoutPreview();
    }
    if (index !== marked) markCurrent();
  };
  rafId = requestAnimationFrame(tick);

  const panes = h(
    'section',
    { class: 'panes' },
    h(
      'figure',
      { class: 'pane' },
      h(
        'figcaption',
        { class: 'pane-caption' },
        copy.sheetAll,
        h('span', { class: 'export-controls' }, saveSheetButton, saveZipButton, saveGifButton),
      ),
      sheetWrap,
      sheetInfo,
    ),
    h(
      'figure',
      { class: 'pane' },
      h('figcaption', { class: 'pane-caption' }, copy.preview),
      previewWrap,
      previewControls,
      strip,
    ),
  );

  host.append(h('div', { class: 'screen sheet' }, bar, sourceBar, notice, waitingArea, panes));

  // ── 화면 갱신 ──
  let drawnSource: PixelBuffer | null = null;
  let timer = 0;

  const update = (state: AppState) => {
    const animation = state.animation;
    renderNotice(notice, state.notice);
    if (!animation) return;

    if (animation.source !== drawnSource) {
      drawnSource = animation.source;
      drawBuffer(sourceCanvas, animation.source);
    }
    sourceInfo.textContent = [
      `${animation.source.width}×${animation.source.height}`,
      `${animation.frameCount}${copy.sheetFrame}`,
      animation.transparent ? copy.transparentBackground : null,
    ]
      .filter(Boolean)
      .join(' · ');
    actionTip.text.textContent = animation.action;
    // 늘린 설명은 응답을 받은 뒤에만 있다. 없으면 버튼도 숨긴다.
    enhancedTip.text.textContent = animation.enhancedPrompt ?? '';
    enhancedTip.wrap.classList.toggle('is-hidden', animation.enhancedPrompt === null);
    if (animation.enhancedPrompt === null) enhancedTip.setOpen(false);
    // 비용은 생성 시작 응답에 온다. 받기 전(보내는 중)에는 숨긴다.
    costInfo.classList.toggle('is-hidden', animation.cost === null);
    costInfo.textContent = animation.cost ? costText(animation.cost, animation.enhance) : '';

    regenerateButton.toggleAttribute('disabled', state.aiBusy);
    regenerateButton.setAttribute('aria-busy', String(state.aiBusy));
    regenerateButton.textContent = state.aiBusy
      ? copy.generatingAnimation
      : copy.regenerateAnimation;

    const generating = animation.startedAt !== null;
    const frames = generating ? [] : animation.frames;
    waitingArea.classList.toggle('is-hidden', !generating);
    panes.classList.toggle('is-hidden', generating);
    empty.classList.toggle('is-hidden', generating || frames.length > 0);
    grid.classList.toggle('is-hidden', frames.length === 0);
    previewControls.classList.toggle('is-hidden', frames.length === 0);
    previewCanvas.classList.toggle('is-hidden', frames.length === 0);
    strip.classList.toggle('is-hidden', frames.length === 0);
    saveSheetButton.toggleAttribute('disabled', frames.length === 0);
    saveZipButton.toggleAttribute('disabled', frames.length === 0);
    saveGifButton.toggleAttribute('disabled', frames.length === 0);
    if (frames.length === 0) closeGif?.();

    // 만드는 중에는 1초마다 경과 시간을 고친다
    clearInterval(timer);
    if (generating) {
      const startedAt = animation.startedAt!;
      const show = () => (elapsed.textContent = formatElapsed(Date.now() - startedAt));
      show();
      timer = window.setInterval(show, 1000);
    }

    if (frames.length > 0) {
      // 버튼을 새로 만들었으면 현재 프레임 표시를 다시 한다
      const gridRebuilt = gridList.render(frames);
      const stripRebuilt = stripList.render(frames);
      if (gridRebuilt || stripRebuilt) marked = -1;
      layoutGrid();
      const { width, height } = frames[0]!;
      const sheet = sheetLayout(width, height, frames.length, SHEET_COLUMNS);
      sheetInfo.textContent = `${width}×${height} ${copy.sheetFrame} ${frames.length}개 → ${sheet.width}×${sheet.height} PNG`;
    } else {
      sheetInfo.textContent = '';
    }
  };

  update(store.getState());
  const unsubscribe = store.subscribe(update);
  const observer = new ResizeObserver(() => {
    layoutGrid();
    layoutPreview();
  });
  observer.observe(sheetWrap);
  observer.observe(previewWrap);

  return () => {
    closeDialog?.();
    closeEditor?.();
    closeGif?.();
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onDocumentKey);
    cancelAnimationFrame(rafId);
    clearInterval(timer);
    unsubscribe();
    observer.disconnect();
    host.replaceChildren();
  };
};
