import {
  ANIMATION_POLL_MS,
  ANIMATION_POLL_RETRIES,
  ANIMATION_TIMEOUT_MS,
} from '../config/constants';
import type { AnimationFrameCount } from '../core/animation';
import { saveFramesZip, savePixelPng, saveSheetPng } from '../io/exportPng';
import { decodeFrame, fetchAnimationJob, PixellabError, startAnimation } from '../io/pixellab';
import { loadImage, LoadError } from '../io/loadImage';
import { extractPalette } from '../core/palette';
import { checkPixelArt } from '../core/pixelArt';
import { pixelate } from '../core/pixelate';
import type { ConvertOptions, PixelBuffer } from '../core/types';
import type { AppState, Mode, NoticeCode, Store } from './store';

/** 화면이 한 번 그려질 시간을 준다. "변환 중…" 표시가 보이게 하려는 것. */
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class TimeoutError extends Error {}

/** 실패 이유를 알림 문구로 바꾼다. */
function failureNotice(error: unknown): NoticeCode {
  if (error instanceof TimeoutError) return 'ai-timeout';
  if (!(error instanceof PixellabError)) return 'ai-failed';
  switch (error.reason) {
    case 'no-credits':
      return 'ai-no-credits';
    case 'busy':
      return 'ai-busy';
    case 'rejected':
    case 'too-large':
    case 'bad-image':
      return 'ai-rejected';
    case 'not-configured':
      return 'ai-not-configured';
    default:
      return 'ai-failed';
  }
}

export type Actions = ReturnType<typeof createActions>;

/** 상태는 이 함수들로만 바꾼다. 화면이 store를 직접 고치지 않는다. */
export function createActions(store: Store<AppState>) {
  /** 애니메이션 요청마다 늘린다. 처음으로 돌아가면 늘려서 진행 중인 조회 결과를 버린다. */
  let animationRun = 0;
  const isCurrent = (run: number) => run === animationRun;

  /** 작업이 끝날 때까지 상태를 조회하고, 완료되면 프레임 PNG(base64) 목록을 돌려준다. */
  const waitForFrames = async (jobId: string, run: number, startedAt: number): Promise<string[] | null> => {
    let failures = 0;
    for (;;) {
      await wait(ANIMATION_POLL_MS);
      if (!isCurrent(run)) return null;
      if (Date.now() - startedAt > ANIMATION_TIMEOUT_MS) throw new TimeoutError();
      try {
        const job = await fetchAnimationJob(jobId);
        failures = 0;
        if (job.status === 'completed') return job.frames;
        if (job.status === 'failed') throw new PixellabError('failed');
      } catch (error) {
        // 조회가 잠깐 끊긴 것은 넘어간다. 작업 자체가 실패했거나 연달아 실패하면 멈춘다.
        if (error instanceof PixellabError && error.reason === 'failed') throw error;
        if (++failures >= ANIMATION_POLL_RETRIES) throw error;
      }
    }
  };

  const actions = {
    /** 처음(두 갈래 고르기)으로 돌아간다. 만든 것은 모두 버린다. */
    goStart(): void {
      animationRun++;
      store.setState({
        step: 'home',
        mode: 'convert',
        source: null,
        converted: null,
        edited: false,
        aiBusy: false,
        animation: null,
        pixelArt: null,
        notice: null,
      });
    },

    /** 변환 경로는 올리기/그리기 화면으로, 애니메이션 경로는 픽셀 그림 올리기 화면으로 간다. */
    chooseMode(mode: Mode): void {
      store.setState({ step: mode === 'convert' ? 'start' : 'animate', mode, notice: null });
    },

    /** 애니메이션 경로: 픽셀 그림 파일을 연다. 픽셀 그림인지는 애니메이션을 만들 때 확인한다. */
    async openPixelArt(file: File): Promise<void> {
      try {
        const { buffer } = await loadImage(file);
        store.setState({ pixelArt: buffer, notice: null });
      } catch (error) {
        const code = error instanceof LoadError ? error.reason : 'decode-failed';
        store.setState({ notice: { kind: 'error', code } });
      }
    },

    /**
     * 올린 그림이 픽셀 그림인지 확인한다. 맞으면 원래 크기로 줄인 그림을 저장하고 돌려준다.
     * 아니면 이유를 알림으로 띄우고 null을 돌려준다.
     */
    preparePixelArt(): PixelBuffer | null {
      const { pixelArt } = store.getState();
      if (!pixelArt) return null;
      const result = checkPixelArt(pixelArt);
      if (!result.ok) {
        const code = result.reason === 'too-large' ? 'not-pixel-art-size' : 'not-pixel-art-colors';
        store.setState({ notice: { kind: 'error', code } });
        return null;
      }
      store.setState({ pixelArt: result.image, notice: null });
      return result.image;
    },

    /** 빈 캔버스에서 새로 그리기 */
    startDrawing(): void {
      store.setState({ step: 'draw', source: null, converted: null, edited: false, notice: null });
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
          edited: false,
          notice: scaled ? { kind: 'info', code: 'resized' } : null,
        });
      } catch (error) {
        const code = error instanceof LoadError ? error.reason : 'decode-failed';
        store.setState({ notice: { kind: 'error', code } });
      }
    },

    useDrawing(buffer: PixelBuffer): void {
      store.setState({ step: 'convert', source: buffer, converted: null, edited: false, notice: null });
    },

    /** 변환 결과를 칸 단위로 고치는 화면으로 간다. */
    editResult(): void {
      if (!store.getState().converted) return;
      store.setState({ step: 'edit', notice: null });
    },

    /**
     * 애니메이션 경로: 올린 픽셀 그림을 고치는 화면으로 간다.
     * 먼저 픽셀 그림인지 확인해서 확대본은 원래 크기로 줄인다. 픽셀 그림이 아니면 안내만 띄운다.
     */
    editPixelArt(): void {
      if (actions.preparePixelArt()) store.setState({ step: 'edit' });
    },

    /** 고친 내용을 버리고 돌아간다(변환 결과나 올린 픽셀 그림은 그대로). */
    cancelEdit(): void {
      store.setState({ step: store.getState().mode === 'animate' ? 'animate' : 'convert' });
    },

    /**
     * 고친 이미지를 반영한다. 애니메이션 경로는 올린 픽셀 그림을 바꾸고,
     * 변환 경로는 변환 결과를 바꾼다(색 개수 표시를 위해 쓰인 색을 다시 센다).
     */
    applyEdit(image: PixelBuffer): void {
      if (store.getState().mode === 'animate') {
        store.setState({ step: 'animate', pixelArt: image, notice: null });
        return;
      }
      store.setState({
        step: 'convert',
        converted: { image, palette: extractPalette(image) },
        edited: true,
        notice: null,
      });
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

    /** 스프라이트 시트 화면으로 간다(만든 애니메이션이 있거나 만드는 중일 때). */
    openSheet(): void {
      if (!store.getState().animation) return;
      store.setState({ step: 'sheet', notice: null });
    },

    /**
     * 애니메이션 앞 단계로 돌아간다(변환 경로는 변환 화면, 애니메이션 경로는 픽셀 그림 올리기 화면).
     * 만드는 중이던 애니메이션은 계속 기다린다.
     */
    backToConvert(): void {
      const { mode, converted } = store.getState();
      const step = mode === 'animate' ? 'animate' : converted ? 'convert' : 'start';
      store.setState({ step, notice: null });
    },

    /**
     * Pixellab으로 애니메이션을 만든다. 스프라이트 시트 화면으로 넘어가서 결과를 기다린다.
     * from: 'result'는 지금 변환 결과로, 'pixel-art'는 올린 픽셀 그림(확인을 통과한 것)으로,
     * 'previous'는 지난번 애니메이션에 쓴 그림으로 다시 만든다.
     * 결과가 오거나 실패할 때까지 aiBusy로 버튼을 막는다(요청마다 요금이 나가는 API라 중복 요청 방지).
     * 실패하면 이전 프레임은 그대로 둔다.
     */
    async generateAnimation(
      request: { action: string; frameCount: AnimationFrameCount; transparent: boolean; enhance: boolean },
      from: 'result' | 'pixel-art' | 'previous',
    ): Promise<void> {
      const { converted, pixelArt, animation, aiBusy } = store.getState();
      const source =
        from === 'previous' ? animation?.source : from === 'pixel-art' ? pixelArt : converted?.image;
      if (!source || aiBusy) return;

      const run = ++animationRun;
      const startedAt = Date.now();
      const previousFrames = from === 'previous' ? (animation?.frames ?? []) : [];
      store.setState({
        step: 'sheet',
        aiBusy: true,
        animation: { source, ...request, enhancedPrompt: null, cost: null, frames: previousFrames, startedAt },
        notice: null,
      });

      try {
        const { jobId, enhancedPrompt, cost } = await startAnimation({ image: source, ...request });
        if (!isCurrent(run)) return;
        // 늘린 설명과 비용은 시작 응답에 바로 오므로 기다리는 동안에도 보여 준다
        const pending = store.getState().animation;
        if (pending) store.setState({ animation: { ...pending, enhancedPrompt, cost } });
        const encoded = await waitForFrames(jobId, run, startedAt);
        if (!encoded) return;
        const frames = await Promise.all(encoded.map(decodeFrame));
        if (!isCurrent(run)) return;
        // 시트는 모든 칸이 같은 크기여야 한다
        if (frames.some((f) => f.width !== frames[0]!.width || f.height !== frames[0]!.height)) {
          throw new PixellabError('upstream');
        }
        store.setState({
          aiBusy: false,
          animation: { ...store.getState().animation!, frames, startedAt: null },
          notice: null,
        });
      } catch (error) {
        if (!isCurrent(run)) return;
        const current = store.getState().animation;
        store.setState({
          aiBusy: false,
          animation: current ? { ...current, startedAt: null } : null,
          notice: { kind: 'error', code: failureNotice(error) },
        });
      }
    },

    /** 지금 프레임(직접 고친 것 포함)을 스프라이트 시트 PNG 한 장 또는 낱장 PNG zip으로 저장한다. 실패할 때만 알린다. */
    async exportAnimation(kind: 'sheet' | 'zip'): Promise<void> {
      const animation = store.getState().animation;
      if (!animation || animation.startedAt !== null || animation.frames.length === 0) return;
      try {
        if (kind === 'sheet') await saveSheetPng(animation.frames);
        else await saveFramesZip(animation.frames);
        store.setState({ notice: null }); // 저장에 성공하면 따로 알리지 않는다
      } catch {
        store.setState({ notice: { kind: 'error', code: 'save-failed' } });
      }
    },

    /** 시트에서 고친 프레임 하나를 반영한다. 미리보기도 이 목록을 읽으므로 바로 반영된다. */
    updateFrame(index: number, image: PixelBuffer): void {
      const { animation } = store.getState();
      if (!animation || index < 0 || index >= animation.frames.length) return;
      const frames = animation.frames.slice();
      frames[index] = image;
      store.setState({ animation: { ...animation, frames }, notice: null });
    },

    async convert(): Promise<void> {
      const { source, convertOptions, converting } = store.getState();
      if (!source || converting) return;
      store.setState({ converting: true, notice: null });
      await nextFrame();
      try {
        store.setState({ converted: pixelate(source, convertOptions), converting: false, edited: false });
      } catch {
        store.setState({ converting: false, notice: { kind: 'error', code: 'convert-failed' } });
      }
    },
  };
  return actions;
}
