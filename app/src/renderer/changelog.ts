// Minimal CHANGELOG.md reader. Output is built with textContent only, so release
// notes fetched from the internet can never inject markup into the app.

export interface Release {
  version: string;
  date: string;
  groups: { title: string; items: string[] }[];
}

const GROUP_NAMES_CS: Record<string, string> = {
  added: 'Přidáno',
  changed: 'Změněno',
  fixed: 'Opraveno',
  removed: 'Odebráno',
  security: 'Bezpečnost',
};

const plain = (text: string) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();

export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  let current: Release | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+\[?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\]?(?:\s*[-–]\s*(.+))?/.exec(line);
    if (heading) {
      current = { version: heading[1], date: plain(heading[2] ?? ''), groups: [] };
      releases.push(current);
      continue;
    }
    if (!current) continue;
    const group = /^###\s+(.+)/.exec(line);
    if (group) {
      current.groups.push({ title: plain(group[1]), items: [] });
      continue;
    }
    const text = plain(line.replace(/^\s*[-*+]\s+/, ''));
    if (!text) continue;
    if (!current.groups.length) current.groups.push({ title: '', items: [] });
    current.groups.at(-1)!.items.push(text);
  }
  return releases;
}

export function renderRelease(release: Release, language: string, showHeading = true): HTMLElement {
  const article = document.createElement('article');
  article.className = 'release';
  if (showHeading) {
    const head = document.createElement('div');
    head.className = 'release-head';
    const version = document.createElement('h3');
    version.textContent = release.version;
    const date = document.createElement('span');
    date.textContent = release.date;
    head.append(version, date);
    article.append(head);
  }
  for (const group of release.groups) {
    if (group.title) {
      const title = document.createElement('h4');
      title.textContent = (language === 'cs' && GROUP_NAMES_CS[group.title.toLowerCase()]) || group.title;
      article.append(title);
    }
    const list = document.createElement('ul');
    for (const item of group.items) {
      const li = document.createElement('li');
      li.textContent = item;
      list.append(li);
    }
    article.append(list);
  }
  return article;
}
