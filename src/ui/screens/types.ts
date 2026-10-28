import type { Actions } from '../../state/actions';
import type { AppState, Store } from '../../state/store';

export interface ScreenContext {
  store: Store<AppState>;
  actions: Actions;
}

/** 화면을 host 안에 그리고, 화면을 떠날 때 부르는 정리 함수를 돌려준다. */
export type Screen = (host: HTMLElement, ctx: ScreenContext) => () => void;
