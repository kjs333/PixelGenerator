import type { Notice } from '../../state/store';
import { noticeText } from '../copy';
import { h } from '../dom';

/** 오류·안내 문구 한 줄. 색만으로 전하지 않도록 아이콘과 문장을 함께 쓴다. */
export function renderNotice(host: HTMLElement, notice: Notice | null): void {
  host.replaceChildren();
  if (!notice) return;
  const icon = notice.kind === 'error' ? '⚠' : 'ℹ';
  host.append(
    h('span', { class: 'notice-icon', 'aria-hidden': 'true' }, icon),
    h('span', {}, noticeText[notice.code]),
  );
}
