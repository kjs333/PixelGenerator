import type { Actions } from '../../state/actions';
import { copy } from '../copy';
import { h } from '../dom';
import { homeIcon } from './icons';

/**
 * 화면 맨 위의 띠: 왼쪽에 로고와 Home 버튼, 오른쪽 끝에 화면이 넘긴 버튼.
 * 로고와 Home은 첫 화면(두 갈래 고르기)으로 간다. 첫 화면에서는 home: false로 Home 버튼을 뺀다.
 */
export function topBar(
  actions: Actions,
  opts: { home?: boolean; trailing?: HTMLElement } = {},
): HTMLElement {
  const logo = h(
    'button',
    { class: 'logo', type: 'button', 'aria-label': copy.backToStart },
    copy.appName,
  );
  logo.addEventListener('click', () => actions.goStart());

  const left = h('div', { class: 'stepbar-left' }, logo);
  if (opts.home !== false) {
    const homeButton = h(
      'button',
      { class: 'btn btn-home', type: 'button' },
      homeIcon(),
      copy.home,
    );
    homeButton.addEventListener('click', () => actions.goStart());
    left.append(homeButton);
  }

  return h('header', { class: 'stepbar' }, left, opts.trailing ?? h('span'));
}
