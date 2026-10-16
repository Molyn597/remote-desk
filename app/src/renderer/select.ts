// Replaces native <select> pop-ups with a menu in the app's style. The hidden
// <select> keeps the value, so forms read and set it as before.
const refreshers = new Set<() => void>();

const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>';

export function enhanceSelect(select: HTMLSelectElement) {
  const wrapper = document.createElement('div');
  wrapper.className = 'select';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'select-button';
  button.setAttribute('aria-haspopup', 'listbox');
  const label = document.createElement('span');
  button.append(label);
  button.insertAdjacentHTML('beforeend', CHEVRON);
  const menu = document.createElement('div');
  menu.className = 'select-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  select.after(wrapper);
  wrapper.append(select, button, menu);
  select.hidden = true;

  const close = () => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };
  const refresh = () => {
    label.textContent = select.selectedOptions[0]?.textContent ?? '';
    menu.replaceChildren(
      ...[...select.options].map((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.setAttribute('role', 'option');
        item.textContent = option.textContent;
        item.classList.toggle('selected', option.selected);
        item.addEventListener('click', () => {
          if (select.value !== option.value) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          refresh();
          close();
          button.focus();
        });
        return item;
      }),
    );
  };
  button.addEventListener('click', () => {
    if (!menu.hidden) return close();
    refresh();
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    menu.querySelector<HTMLElement>('.selected')?.focus();
  });
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      e.preventDefault();
      close();
      button.focus();
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !menu.hidden) {
      e.preventDefault();
      const items = [...menu.querySelectorAll<HTMLElement>('button')];
      const index = items.indexOf(document.activeElement as HTMLElement);
      items[(index + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (!wrapper.contains(e.target as Node)) close();
  });
  refreshers.add(refresh);
  refresh();
}

// Call after setting a select's value from code or changing the language.
export function refreshSelects() {
  refreshers.forEach((refresh) => refresh());
}
