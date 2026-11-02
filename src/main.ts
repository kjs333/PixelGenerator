import './styles/tokens.css';
import './styles/base.css';
import './styles/screens.css';
import { createActions } from './state/actions';
import { createStore, initialState, type Step } from './state/store';
import { convertScreen } from './ui/screens/convert';
import { drawScreen } from './ui/screens/draw';
import { editScreen } from './ui/screens/edit';
import { homeScreen } from './ui/screens/home';
import { pixelUploadScreen } from './ui/screens/pixelUpload';
import { sheetScreen } from './ui/screens/sheet';
import { startScreen } from './ui/screens/start';
import type { Screen } from './ui/screens/types';

const SCREENS: Record<Step, Screen> = {
  home: homeScreen,
  start: startScreen,
  draw: drawScreen,
  convert: convertScreen,
  edit: editScreen,
  animate: pixelUploadScreen,
  sheet: sheetScreen,
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
  destroyScreen = SCREENS[step](host!, { store, actions });
}

show(store.getState().step);
store.subscribe((state) => {
  if (state.step !== currentStep) show(state.step);
});
