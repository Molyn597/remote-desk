import { currentLanguage } from './i18n';

type Section = { title: string; steps: string[]; icons?: string[] };

const ICONS = {
  scale: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />',
  fullscreen: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />',
  monitor: '<rect x="2" y="4" width="12" height="9" rx="1.5" /><rect x="10" y="9" width="12" height="9" rx="1.5" /><path d="M14 22h4M16 18v4" />',
  quality: '<path d="M12 20a8 8 0 1 0-8-8M12 12l4-4" /><circle cx="12" cy="12" r="1.5" />',
  view: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />',
  keys: '<rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />',
  clipboard: '<rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />',
  file: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />',
  screenshot: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />',
  pin: '<path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z" />',
  close: '<path d="M18 6L6 18M6 6l12 12" />',
};

const TOOLBAR_ICONS = Object.values(ICONS);

const cs: Section[] = [
  {
    title: 'Nechat se ovládat',
    steps: [
      'Pošlete partnerovi své ID a heslo z karty „Povolit vzdálené ovládání“. Tlačítkem pro kopírování je dostanete do schránky.',
      'Když se partner připojí, uvidíte jeho jméno a ID a vyberete: Povolit ovládání, Jen sledování, nebo Odmítnout. Bez vašeho souhlasu se nikdo nepřipojí.',
      'Během relace je nahoře černý panel, vždy nad ostatními okny. Můžete v něm pozastavit ovládání nebo relaci odpojit. Když pohnete myší, máte přednost před partnerem.',
      'Po relaci si můžete vygenerovat nové heslo (šrafované tlačítko vedle hesla).',
    ],
  },
  {
    title: 'Ovládat jiný počítač',
    steps: [
      'Na druhém počítači musí běžet Remote Desk. Zadejte jeho ID a heslo do karty „Ovládat vzdálený počítač“ a klikněte na Připojit.',
      'Počkejte, až partner připojení povolí. Pak uvidíte jeho obrazovku a můžete ovládat myš i klávesnici.',
      'Kliknutím do obrazu převezmete klávesnici. Zkratky jako Cmd+C nebo Ctrl+C se posílají na vzdálený počítač.',
      'Nedávná připojení najdete dole na hlavní stránce, stačí doplnit heslo. V Nastavení si můžete zadat jméno, které partner uvidí.',
    ],
  },
  {
    title: 'Připojení bez hesla',
    steps: [
      'Při prvním připojení musí partner u svého počítače zaškrtnout „Pamatovat si toto zařízení“.',
      'Jeho počítač se vám pak objeví v sekci Moje zařízení na hlavní stránce. Příště se připojíte jedním kliknutím, bez hesla a bez dotazu.',
      'Aby to šlo i v době, kdy u počítače nikdo není, zapněte na něm v Nastavení „Spouštět po přihlášení a běžet na pozadí“.',
      'Přístup zrušíte na tom počítači v Nastavení → Důvěryhodná zařízení. Tlačítko „Odebrat vše a vyměnit klíč“ ho sebere všem najednou.',
    ],
  },
  {
    title: 'Lišta během relace',
    steps: [
      'Přizpůsobit oknu nebo skutečná velikost (v ní se obraz posouvá u okrajů).',
      'Celá obrazovka.',
      'Monitor (jen když jich má vzdálený počítač víc): zobrazit jeden z nich, nebo všechny vedle sebe. V režimu vedle sebe přetáhnete okno z jednoho monitoru na druhý; štítek nad monitorem přepne zpět jen na něj.',
      'Kvalita: automaticky, upřednostnit rychlost (slabá síť), nebo kvalitu.',
      'Jen sledovat: obraz vidíte, ale nic neovládáte.',
      'Odeslat zkratku, kterou by jinak zachytil váš systém (Alt+Tab, Win, Cmd+Tab…).',
      'Sdílená schránka: co zkopírujete na jednom počítači, můžete vložit na druhém. Tlačítkem ji vypnete.',
      'Odeslat soubory na vzdálený počítač (nebo je přetáhněte do obrazu). Uloží se do Stažených souborů.',
      'Stáhnout soubory ze vzdáleného počítače: na jeho ploše se otevře výběr souborů. Soubor zkopírovaný tam (Ctrl/Cmd+C) nabídne tlačítko Stáhnout.',
      'Uložit snímek obrazovky.',
      'Ponechat lištu zobrazenou. Jinak se schová a objeví se po najetí myší k hornímu okraji.',
      'Odpojit.',
    ],
    icons: TOOLBAR_ICONS,
  },
  {
    title: 'Bezpečnost',
    steps: [
      'Nikdy nedávejte ID a heslo nikomu, kdo vám sám zavolal. Banky, Microsoft ani policie vzdálený přístup nechtějí.',
      'Heslo se nikam neposílá. Slouží jako klíč, kterým se spojení šifruje.',
      'Obraz a ovládání jdou přímo mezi počítači a jsou šifrované.',
    ],
  },
  {
    title: 'Když něco nefunguje',
    steps: [
      '„Nepodařilo se připojit“: zkontrolujte ID a heslo, že na druhém počítači běží Remote Desk a že oba počítače mají v Nastavení stejnou síť.',
      'Pomalý nebo trhaný obraz: v liště zvolte Kvalita → Upřednostnit rychlost.',
      'Na mobilních datech nebo ve firemní síti se spojení nemusí navázat. Pomůže TURN relé v Nastavení.',
      'Na Macu musí ovládaný počítač mít povolené Nahrávání obrazovky a Zpřístupnění (stránka Oprávnění).',
    ],
  },
];

const en: Section[] = [
  {
    title: 'Let someone control this computer',
    steps: [
      'Send your partner the ID and password from the “Allow remote control” card. The copy buttons put them on the clipboard.',
      'When your partner connects, you see their name and ID and choose: Allow control, View only, or Deny. Nobody gets in without your approval.',
      'During the session a black panel stays on top of all windows. Use it to pause control or disconnect. When you move your mouse, you take priority over your partner.',
      'After the session you can generate a new password (hatched button next to it).',
    ],
  },
  {
    title: 'Control another computer',
    steps: [
      'Remote Desk must be running on the other computer. Enter its ID and password under “Control remote computer” and click Connect.',
      'Wait until your partner allows the connection. Then you see their screen and can use the mouse and keyboard.',
      'Click into the picture to take over the keyboard. Shortcuts like Cmd+C or Ctrl+C are sent to the remote computer.',
      'Recent connections are listed at the bottom of the home page; just add the password. In Settings you can set the name your partner sees.',
    ],
  },
  {
    title: 'Connect without a password',
    steps: [
      'The first time, your partner ticks “Remember this device” at their computer when allowing the connection.',
      'Their computer then appears under My devices on the home page. Next time you connect with one click, no password and no prompt.',
      'For access while nobody is at that computer, turn on “Start at login and run in the background” in its Settings.',
      'To revoke access, use Settings → Trusted devices on that computer. “Remove all and replace the key” revokes every device at once.',
    ],
  },
  {
    title: 'Session toolbar',
    steps: [
      'Fit to window or original size (the picture pans at the edges).',
      'Full screen.',
      'Monitor (only when the remote computer has more than one): show one of them, or all side by side. Side by side, you can drag a window from one monitor to the other; the label above a monitor switches back to it alone.',
      'Quality: automatic, optimize speed (slow networks) or optimize quality.',
      'View only: you see the screen but control nothing.',
      'Send a shortcut your own system would otherwise catch (Alt+Tab, Win, Cmd+Tab…).',
      'Shared clipboard: copy on one computer, paste on the other. Click to turn it off.',
      'Send files to the remote computer (or drop them onto the picture). They are saved to Downloads.',
      'Get files from the remote computer: a file picker opens on its screen. A file copied there (Ctrl/Cmd+C) shows a Download button.',
      'Save a screenshot.',
      'Keep the toolbar visible. Otherwise it hides and comes back when you move the mouse to the top edge.',
      'Disconnect.',
    ],
    icons: TOOLBAR_ICONS,
  },
  {
    title: 'Safety',
    steps: [
      'Never give your ID and password to someone who called you. Banks, Microsoft and the police never ask for remote access.',
      'The password is never sent anywhere. It is the key that encrypts the connection.',
      'Video and input go directly between the computers and are encrypted.',
    ],
  },
  {
    title: 'Troubleshooting',
    steps: [
      '“Could not connect”: check the ID and password, that Remote Desk is running on the other computer and that both use the same network in Settings.',
      'Slow or choppy picture: choose Quality → Optimize speed in the toolbar.',
      'On mobile data or corporate networks a connection may fail. A TURN relay in Settings helps.',
      'On a Mac, the controlled computer needs Screen Recording and Accessibility permissions (Permissions page).',
    ],
  },
];

export function renderHelp(container: HTMLElement) {
  const sections = currentLanguage() === 'cs' ? cs : en;
  container.replaceChildren(
    ...sections.map((section) => {
      const panel = document.createElement('section');
      panel.className = 'panel help-section';
      const title = document.createElement('h3');
      title.textContent = section.title;
      const list = document.createElement('ol');
      list.className = 'help-steps';
      section.steps.forEach((text, i) => {
        const item = document.createElement('li');
        const marker = document.createElement('span');
        marker.className = 'help-marker';
        if (section.icons) {
          marker.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${section.icons[i]}</svg>`;
        } else {
          marker.textContent = String(i + 1);
        }
        const body = document.createElement('span');
        body.textContent = text;
        item.append(marker, body);
        list.append(item);
      });
      panel.append(title, list);
      return panel;
    }),
  );
}
