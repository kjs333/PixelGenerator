import type { Actions } from '../../state/actions';
import { copy } from '../copy';
import { h } from '../dom';

/** 상단 단계 바. Day 1에는 ① 변환만 있고 나머지는 비활성이다. */
export function stepBar(actions: Actions): HTMLElement {
  const logo = h('button', { class: 'logo', type: 'button', 'aria-label': copy.backToStart }, copy.appName);
  logo.addEventListener('click', () => actions.goStart());

  const step = (label: string, state: 'current' | 'disabled') => {
    const item = h('li', { class: `step is-${state}` }, label);
    if (state === 'current') item.setAttribute('aria-current', 'step');
    else {
      item.setAttribute('aria-disabled', 'true');
      item.title = copy.stepNotReady;
    }
    return item;
  };

  const steps = h(
    'ol',
    { class: 'steps' },
    step(copy.stepConvert, 'current'),
    step(copy.stepAnimate, 'disabled'),
    step(copy.stepSheet, 'disabled'),
  );

  const exportButton = h('button', { class: 'btn', type: 'button', disabled: true }, copy.exportPng);
  exportButton.title = copy.exportDisabledTip;

  const backButton = h('button', { class: 'btn', type: 'button' }, `← ${copy.backToStart}`);
  backButton.addEventListener('click', () => actions.goStart());

  return h(
    'header',
    { class: 'stepbar' },
    h('div', { class: 'stepbar-left' }, logo, backButton),
    h('nav', { 'aria-label': '작업 단계' }, steps),
    exportButton,
  );
}
