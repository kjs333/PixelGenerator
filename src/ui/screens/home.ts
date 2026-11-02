import { copy } from '../copy';
import { topBar } from '../components/topBar';
import { h } from '../dom';
import type { Screen } from './types';

/** 첫 화면: 사진·그림을 픽셀로 변환 / 픽셀 그림으로 애니메이션 만들기 중 하나를 고른다. */
export const homeScreen: Screen = (host, { actions }) => {
  const choice = (title: string, hint: string, go: () => void) => {
    const button = h(
      'button',
      { class: 'choice', type: 'button' },
      h('strong', { class: 'choice-title' }, title),
      h('span', {}, hint),
    );
    button.addEventListener('click', go);
    return button;
  };

  host.append(
    h(
      'div',
      { class: 'screen landing' },
      topBar(actions, { home: false }),
      h(
        'main',
        { class: 'start' },
        h('h1', { class: 'start-title' }, copy.homeTitle),
        h(
          'div',
          { class: 'choices' },
          choice(copy.homeConvertTitle, copy.homeConvertHint, () => actions.chooseMode('convert')),
          choice(copy.homeAnimateTitle, copy.homeAnimateHint, () => actions.chooseMode('animate')),
        ),
      ),
    ),
  );

  return () => host.replaceChildren();
};
