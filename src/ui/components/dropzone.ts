import { h } from '../dom';

const ACCEPT = 'image/png,image/jpeg,image/webp';

/**
 * 파일 올리기 카드: 끌어다 놓거나 눌러서(Enter·Space 포함) 이미지 하나를 고른다.
 * input은 화면에 숨겨 두어야 하므로 카드와 함께 돌려준다. openPicker로 다른 버튼에서도 고르기 창을 연다.
 */
export function dropzone(children: (Node | string)[], onFile: (file: File) => void) {
  const input = h('input', { type: 'file', accept: ACCEPT, class: 'visually-hidden', tabindex: '-1' });
  const openPicker = () => input.click();

  const element = h('div', { class: 'choice dropzone', role: 'button', tabindex: '0' }, ...children);
  element.addEventListener('click', openPicker);
  element.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  });
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    element.classList.add('is-over');
  });
  element.addEventListener('dragleave', () => element.classList.remove('is-over'));
  element.addEventListener('drop', (e) => {
    e.preventDefault();
    element.classList.remove('is-over');
    const file = e.dataTransfer?.files[0];
    if (file) onFile(file);
  });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = ''; // 같은 파일을 다시 골라도 change가 일어나게
    if (file) onFile(file);
  });

  return { element, input, openPicker };
}
