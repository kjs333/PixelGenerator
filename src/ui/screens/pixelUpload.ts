import { DEFAULT_ANIMATION_FRAMES } from '../../config/constants';
import { hasTransparency } from '../../core/buffer';
import type { PixelBuffer } from '../../core/types';
import { openAnimateDialog } from '../components/animateDialog';
import { dropzone } from '../components/dropzone';
import { renderNotice } from '../components/notice';
import { topBar } from '../components/topBar';
import { copy } from '../copy';
import { h } from '../dom';
import { drawBuffer } from '../render';
import type { Screen } from './types';

/**
 * 픽셀 그림 올리기 화면(애니메이션 경로).
 * 그림을 올리면 미리보기가 나오고, "애니메이션 생성"을 누르면 픽셀 그림인지 확인한 뒤
 * 변환 화면과 같은 애니메이션 창을 띄운다. 픽셀 그림이 아니면 알림만 띄운다.
 */
export const pixelUploadScreen: Screen = (host, { store, actions }) => {
  const upload = dropzone(
    [
      h('strong', { class: 'choice-title' }, copy.pixelUploadTitle),
      h('span', {}, copy.pixelUploadHint),
      h('span', { class: 'muted' }, copy.pixelUploadSpec),
    ],
    (file) => void actions.openPixelArt(file),
  );

  const previewCanvas = h('canvas', { class: 'pixel-preview-canvas' });
  const changeButton = h('button', { class: 'btn', type: 'button' }, copy.pixelUploadChange);
  changeButton.addEventListener('click', upload.openPicker);
  const preview = h(
    'figure',
    { class: 'pixel-preview', 'aria-label': copy.pixelArtPreview },
    h('div', { class: 'pixel-preview-wrap' }, previewCanvas),
    h('div', { class: 'pixel-preview-caption' }, changeButton),
  );

  // 애니메이션 생성: 픽셀 그림인지 먼저 확인하고, 맞으면 동작 설명과 프레임 수를 묻는 창을 띄운다
  let closeAnimate: (() => void) | null = null;
  const animateButton = h('button', { class: 'btn btn-primary', type: 'button' }, copy.generateAnimation);
  animateButton.addEventListener('click', () => {
    if (closeAnimate) return;
    const image = actions.preparePixelArt();
    if (!image) return;
    const { animation } = store.getState();
    closeAnimate = openAnimateDialog({
      width: image.width,
      height: image.height,
      action: animation?.action ?? '',
      frameCount: animation?.frameCount ?? DEFAULT_ANIMATION_FRAMES,
      // 처음에는 그림에 투명한 칸이 있으면 투명 배경으로 만든다
      transparent: hasTransparency(image),
      enhance: animation?.enhance ?? false, // 추가 비용이 들므로 처음에는 끈다
      onSubmit: (request) => void actions.generateAnimation(request, 'pixel-art'),
      onClose: () => {
        closeAnimate = null;
      },
    });
  });
  const bar = topBar(actions, { trailing: animateButton });

  // 알림(픽셀 그림이 아님, 파일을 못 읽음 등)은 그림이나 올리기 카드 바로 아래에 보여 준다
  const notice = h('p', { class: 'notice pixel-upload-notice', role: 'alert' });
  const body = h('main', { class: 'pixel-upload-body' });

  host.append(h('div', { class: 'screen pixel-upload' }, bar, body, upload.input));

  let shown: PixelBuffer | null | undefined;
  const sync = () => {
    const state = store.getState();
    renderNotice(notice, state.notice);
    if (state.pixelArt !== shown) {
      shown = state.pixelArt;
      if (shown) {
        drawBuffer(previewCanvas, shown);
        body.replaceChildren(preview, notice);
      } else {
        body.replaceChildren(upload.element, notice);
      }
    }
    animateButton.toggleAttribute('disabled', !state.pixelArt || state.aiBusy);
    animateButton.setAttribute('aria-busy', String(state.aiBusy));
    animateButton.textContent = state.aiBusy ? copy.generatingAnimation : copy.generateAnimation;
    animateButton.title = state.pixelArt ? copy.pixelArtTip : copy.pixelArtMissingTip;
  };

  sync();
  const unsubscribe = store.subscribe(sync);
  return () => {
    unsubscribe();
    closeAnimate?.();
    host.replaceChildren();
  };
};
