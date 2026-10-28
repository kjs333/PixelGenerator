import { savePixelPng } from '../io/exportPng';
import { loadImage, LoadError } from '../io/loadImage';
import { pixelate } from '../core/pixelate';
import type { ConvertOptions, PixelBuffer } from '../core/types';
import type { AppState, Store } from './store';

/** 화면이 한 번 그려질 시간을 준다. "변환 중…" 표시가 보이게 하려는 것. */
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

export type Actions = ReturnType<typeof createActions>;

/** 상태는 이 함수들로만 바꾼다. 화면이 store를 직접 고치지 않는다. */
export function createActions(store: Store<AppState>) {
  return {
    goStart(): void {
      store.setState({ step: 'start', source: null, converted: null, notice: null });
    },

    /** 빈 캔버스에서 새로 그리기 */
    startDrawing(): void {
      store.setState({ step: 'draw', source: null, converted: null, notice: null });
    },

    /** 올린 사진(원본) 위에 펜으로 덧그리기. 그림판 화면이 원본을 바탕으로 깐다. */
    editSource(): void {
      if (!store.getState().source) return;
      store.setState({ step: 'draw', notice: null });
    },

    /** 덧그린 내용을 버리고 변환 화면으로 돌아간다(원본은 그대로). */
    cancelDrawing(): void {
      store.setState({ step: store.getState().source ? 'convert' : 'start' });
    },

    async openFile(file: File): Promise<void> {
      try {
        const { buffer, scaled } = await loadImage(file);
        store.setState({
          step: 'convert',
          source: buffer,
          converted: null,
          notice: scaled ? { kind: 'info', code: 'resized' } : null,
        });
      } catch (error) {
        const code = error instanceof LoadError ? error.reason : 'decode-failed';
        store.setState({ notice: { kind: 'error', code } });
      }
    },

    useDrawing(buffer: PixelBuffer): void {
      store.setState({ step: 'convert', source: buffer, converted: null, notice: null });
    },

    setOptions(patch: Partial<ConvertOptions>): void {
      store.setState({ convertOptions: { ...store.getState().convertOptions, ...patch } });
    },

    /** 변환 결과를 PNG 파일로 저장한다. scale 1이 원래 해상도. */
    async exportResult(scale: number): Promise<void> {
      const { converted } = store.getState();
      if (!converted) return;
      try {
        await savePixelPng(converted.image, scale);
        store.setState({ notice: { kind: 'info', code: 'saved' } });
      } catch {
        store.setState({ notice: { kind: 'error', code: 'save-failed' } });
      }
    },

    async convert(): Promise<void> {
      const { source, convertOptions, converting } = store.getState();
      if (!source || converting) return;
      store.setState({ converting: true, notice: null });
      await nextFrame();
      try {
        store.setState({ converted: pixelate(source, convertOptions), converting: false });
      } catch {
        store.setState({ converting: false, notice: { kind: 'error', code: 'convert-failed' } });
      }
    },
  };
}
