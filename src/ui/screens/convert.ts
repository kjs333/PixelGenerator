import {
  ART_SIZE_PRESETS,
  EXPORT_SCALES,
  MAX_ART_SIZE,
  MAX_COLORS,
  MIN_COLORS,
} from '../../config/constants';
import type { DitherMode } from '../../core/types';
import type { AppState } from '../../state/store';
import { renderNotice } from '../components/notice';
import { stepBar } from '../components/stepBar';
import { copy } from '../copy';
import { h } from '../dom';
import { drawBuffer } from '../render';
import type { Screen } from './types';

const MAX_ZOOM = 32;

const DITHER_CHOICES: { mode: DitherMode; label: string; name: string }[] = [
  { mode: 'none', label: copy.ditherNone, name: copy.ditherNone },
  { mode: 'bayer', label: copy.ditherBayer, name: 'Bayer' },
  { mode: 'floyd-steinberg', label: copy.ditherFs, name: 'Floyd-Steinberg' },
];

const clampSize = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(MAX_ART_SIZE, Math.max(1, Math.round(value))) : fallback;

/** ① 변환 화면: 옵션을 고르고 "변환하기"를 누르면 원본(왼쪽) / 결과(오른쪽)를 나란히 보여 준다. */
export const convertScreen: Screen = (host, { store, actions }) => {
  let customMode = false;

  // ── 옵션 줄 ──
  const presetButtons = ART_SIZE_PRESETS.map((size) => {
    const b = h('button', { class: 'btn seg', type: 'button' }, String(size));
    b.addEventListener('click', () => {
      customMode = false;
      actions.setOptions({ width: size, height: size });
      update(store.getState());
    });
    return { size, el: b };
  });
  const customButton = h('button', { class: 'btn seg', type: 'button' }, copy.customResolution);
  customButton.addEventListener('click', () => {
    customMode = true;
    update(store.getState());
  });

  const widthInput = h('input', { type: 'number', min: 1, max: MAX_ART_SIZE, 'aria-label': copy.width });
  const heightInput = h('input', { type: 'number', min: 1, max: MAX_ART_SIZE, 'aria-label': copy.height });
  const onSizeChange = () => {
    const { convertOptions } = store.getState();
    actions.setOptions({
      width: clampSize(widthInput.valueAsNumber, convertOptions.width),
      height: clampSize(heightInput.valueAsNumber, convertOptions.height),
    });
  };
  widthInput.addEventListener('change', onSizeChange);
  heightInput.addEventListener('change', onSizeChange);
  const customFields = h('span', { class: 'custom-size' }, widthInput, '×', heightInput);

  const colorsValue = h('output', { class: 'value' });
  const colorsInput = h('input', { type: 'range', min: MIN_COLORS, max: MAX_COLORS, 'aria-label': copy.colors });
  colorsInput.addEventListener('input', () => actions.setOptions({ colors: Number(colorsInput.value) }));

  const ditherButtons = DITHER_CHOICES.map((choice) => {
    const b = h('button', { class: 'btn seg', type: 'button', 'aria-label': choice.name }, choice.label);
    b.addEventListener('click', () => actions.setOptions({ dither: choice.mode }));
    return { mode: choice.mode, el: b };
  });

  // ── 디더링 설명: "i" 버튼을 누르면 열리고, 다시 누르거나 바깥을 누르거나 Esc를 누르면 닫힌다 ──
  const infoButton = h(
    'button',
    {
      class: 'info-btn',
      type: 'button',
      'aria-label': copy.ditherInfoLabel,
      'aria-expanded': 'false',
      'aria-controls': 'dither-info',
    },
    'i',
  );
  const infoTip = h(
    'div',
    { class: 'tooltip is-hidden', id: 'dither-info', role: 'region', 'aria-label': copy.ditherInfoTitle },
    h('strong', {}, copy.ditherInfoTitle),
    h('p', {}, copy.ditherInfoIntro),
    h(
      'ul',
      {},
      h('li', {}, h('b', {}, `${copy.ditherNone}: `), copy.ditherInfoNone),
      h('li', {}, h('b', {}, 'Bayer: '), copy.ditherInfoBayer),
      h('li', {}, h('b', {}, 'FS: '), copy.ditherInfoFs),
    ),
    h('p', { class: 'muted' }, copy.ditherInfoNote),
  );
  const infoWrap = h('span', { class: 'info' }, infoButton, infoTip);

  const setInfoOpen = (open: boolean) => {
    infoTip.classList.toggle('is-hidden', !open);
    infoButton.setAttribute('aria-expanded', String(open));
  };
  infoButton.addEventListener('click', () => setInfoOpen(infoTip.classList.contains('is-hidden')));
  const onDocumentClick = (e: MouseEvent) => {
    if (!(e.target instanceof Node) || !infoWrap.contains(e.target)) setInfoOpen(false);
  };
  const onDocumentKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || infoTip.classList.contains('is-hidden')) return;
    setInfoOpen(false);
    infoButton.focus();
  };
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKey);

  const cleanupInput = h('input', { type: 'checkbox' });
  cleanupInput.addEventListener('change', () => actions.setOptions({ cleanup: cleanupInput.checked }));
  const cleanupLabel = h('label', { class: 'option-group check' }, cleanupInput, copy.cleanup);

  const convertButton = h('button', { class: 'btn btn-primary', type: 'button' }, copy.convert);
  convertButton.addEventListener('click', () => void actions.convert());

  const options = h(
    'section',
    { class: 'options', 'aria-label': '변환 옵션' },
    h('div', { class: 'option-group' },
      h('span', { class: 'label' }, copy.resolution),
      h('div', { class: 'seg-group' }, ...presetButtons.map((p) => p.el), customButton),
      customFields,
    ),
    h('div', { class: 'option-group' }, h('span', { class: 'label' }, copy.colors), colorsInput, colorsValue),
    h('div', { class: 'option-group' },
      h('span', { class: 'label' }, copy.dither),
      infoWrap,
      h('div', { class: 'seg-group' }, ...ditherButtons.map((d) => d.el)),
    ),
    cleanupLabel,
    convertButton,
  );

  // ── 좌우 캔버스 ──
  const sourceCanvas = h('canvas', { class: 'view-canvas' });
  const resultCanvas = h('canvas', { class: 'view-canvas pixelated' });
  const sourceWrap = h('div', { class: 'canvas-wrap is-source' }, sourceCanvas);
  const resultEmpty = h('p', { class: 'empty muted' }, copy.resultEmpty);
  const resultWrap = h('div', { class: 'canvas-wrap is-result' }, resultCanvas, resultEmpty);
  const status = h('footer', { class: 'statusbar', 'aria-live': 'polite' });
  const notice = h('p', { class: 'notice', role: 'alert' });

  const drawOnSourceButton = h('button', { class: 'btn', type: 'button' }, copy.drawOnSource);
  drawOnSourceButton.addEventListener('click', () => actions.editSource());

  // ── PNG 저장: 원래 해상도가 기본, 2·4·8배 확대 선택 가능 ──
  const scaleOptions = EXPORT_SCALES.map((scale) => ({
    scale,
    el: h('option', { value: String(scale) }),
  }));
  const scaleSelect = h(
    'select',
    { class: 'select', 'aria-label': copy.exportScale },
    ...scaleOptions.map((o) => o.el),
  );
  const saveButton = h('button', { class: 'btn', type: 'button' }, copy.savePng);
  saveButton.addEventListener('click', () => void actions.exportResult(Number(scaleSelect.value)));
  const exportControls = h('span', { class: 'export-controls' }, scaleSelect, saveButton);

  const panes = h(
    'section',
    { class: 'panes' },
    h('figure', { class: 'pane' }, h('figcaption', { class: 'pane-caption' }, copy.original, drawOnSourceButton), sourceWrap),
    h('figure', { class: 'pane' }, h('figcaption', { class: 'pane-caption' }, copy.result, exportControls), resultWrap),
  );

  host.append(h('div', { class: 'screen convert' }, stepBar(actions), options, notice, panes, status));

  // ── 화면 갱신: 컨트롤은 다시 만들지 않고 값만 바꾼다(슬라이더 조작이 끊기지 않게) ──
  let zoom = 1;

  const layoutCanvases = (state: AppState) => {
    const place = (canvas: HTMLCanvasElement, wrap: HTMLElement, integerOnly: boolean) => {
      if (canvas.width === 0 || canvas.height === 0) return 1;
      const fit = Math.min(wrap.clientWidth / canvas.width, wrap.clientHeight / canvas.height);
      const scale = integerOnly ? Math.min(MAX_ZOOM, Math.max(1, Math.floor(fit))) : Math.min(1, fit);
      canvas.style.width = `${Math.max(1, Math.floor(canvas.width * scale))}px`;
      canvas.style.height = `${Math.max(1, Math.floor(canvas.height * scale))}px`;
      return scale;
    };
    if (state.source) place(sourceCanvas, sourceWrap, false);
    if (state.converted) zoom = place(resultCanvas, resultWrap, true);
  };

  let drawnSource: AppState['source'] = null;
  let drawnResult: AppState['converted'] = null;

  const update = (state: AppState) => {
    const { width, height, colors, dither, cleanup } = state.convertOptions;

    const isPreset = presetButtons.some((p) => p.size === width && p.size === height);
    const showCustom = customMode || !isPreset;
    presetButtons.forEach((p) =>
      p.el.setAttribute('aria-pressed', String(!showCustom && p.size === width && p.size === height)),
    );
    customButton.setAttribute('aria-pressed', String(showCustom));
    customFields.classList.toggle('is-hidden', !showCustom);
    widthInput.value = String(width);
    heightInput.value = String(height);

    colorsInput.value = String(colors);
    colorsValue.textContent = String(colors);
    ditherButtons.forEach((d) => d.el.setAttribute('aria-pressed', String(d.mode === dither)));

    // 디더링은 일부러 외톨이 무늬를 만들므로 외톨이 정리는 디더링 없음일 때만 쓸 수 있다
    cleanupInput.checked = cleanup;
    cleanupInput.toggleAttribute('disabled', dither !== 'none');
    cleanupLabel.title = dither === 'none' ? copy.cleanupTip : copy.cleanupDisabledTip;

    convertButton.toggleAttribute('disabled', state.converting || !state.source);
    convertButton.textContent = state.converting ? copy.converting : copy.convert;

    renderNotice(notice, state.notice);

    if (state.source !== drawnSource) {
      drawnSource = state.source;
      if (state.source) drawBuffer(sourceCanvas, state.source);
    }
    if (state.converted !== drawnResult) {
      drawnResult = state.converted;
      if (state.converted) drawBuffer(resultCanvas, state.converted.image);
    }
    const hasResult = state.converted !== null;

    // 저장 크기 선택지에는 실제로 저장될 크기를 함께 보여 준다(예: "4배 (128×128)")
    scaleOptions.forEach(({ scale, el }) => {
      const label = scale === 1 ? copy.exportScaleOriginal : `${scale}배`;
      const image = state.converted?.image;
      el.textContent = image ? `${label} (${image.width * scale}×${image.height * scale})` : label;
    });
    scaleSelect.toggleAttribute('disabled', !hasResult);
    saveButton.toggleAttribute('disabled', !hasResult);

    resultCanvas.classList.toggle('is-hidden', !hasResult);
    resultEmpty.classList.toggle('is-hidden', hasResult);

    layoutCanvases(state);
    status.textContent = state.converted
      ? `${state.converted.image.width}×${state.converted.image.height} · ${copy.statusColors} ${state.converted.palette.length}개 · ${copy.statusZoom} ${zoom * 100}%`
      : '';
  };

  update(store.getState());
  const unsubscribe = store.subscribe(update);
  const observer = new ResizeObserver(() => layoutCanvases(store.getState()));
  observer.observe(sourceWrap);
  observer.observe(resultWrap);

  return () => {
    unsubscribe();
    observer.disconnect();
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onDocumentKey);
    host.replaceChildren();
  };
};
