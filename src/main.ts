import './styles/tokens.css';
import './styles/base.css';
import './styles/screens.css';
import { createActions } from './state/actions';
import { createStore, initialState, type Step } from './state/store';
import { convertScreen } from './ui/screens/convert';
import { drawScreen } from './ui/screens/draw';
import { editScreen } from './ui/screens/edit';
import { startScreen } from './ui/screens/start';
import type { Screen } from './ui/screens/types';

const SCREENS: Partial<Record<Step, Screen>> = {
  start: startScreen,
  draw: drawScreen,
  convert: convertScreen,
  edit: editScreen,
};

const host = document.getElementById('app');
if (!host) throw new Error('#app 요소를 찾을 수 없어요');

const store = createStore(initialState);
const actions = createActions(store);

let currentStep: Step | null = null;
let destroyScreen: () => void = () => {};

function show(step: Step): void {
  destroyScreen();
  currentStep = step;
  const screen = SCREENS[step] ?? startScreen; // 아직 없는 단계(Day 2~3)는 시작 화면으로
  destroyScreen = screen(host!, { store, actions });
}

show(store.getState().step);
store.subscribe((state) => {
  if (state.step !== currentStep) show(state.step);
});
