# Návod k Remote Desk

[English version](guide.md)

Remote Desk umožní ovládat jiný počítač na dálku, nebo nechat někoho ovládat ten váš. Nepotřebujete
účet ani vlastní server, stačí ID a heslo.

## Obsah

1. [Instalace](#instalace)
2. [Nechat se ovládat](#nechat-se-ovládat)
3. [Ovládat jiný počítač](#ovládat-jiný-počítač)
4. [Oblíbené: připojení bez hesla](#oblíbené-připojení-bez-hesla)
5. [Lišta během relace](#lišta-během-relace)
6. [Nastavení](#nastavení)
7. [Bezpečnost](#bezpečnost)
8. [Když něco nefunguje](#když-něco-nefunguje)

## Instalace

Instalátor stáhnete ze stránky [Releases](../../../releases).

### Windows

1. Stáhněte `Remote-Desk-…-win-x64.exe`. Na počítačích s procesorem ARM zvolte `arm64`.
2. Spusťte ho. Aplikace se nainstaluje jedním kliknutím a rovnou se otevře.
3. Aplikace zatím není digitálně podepsaná, proto Windows SmartScreen může zobrazit
   „Systém Windows ochránil váš počítač“. Klikněte na **Další informace → Přesto spustit**.

Windows nepotřebují žádná další oprávnění.

### macOS

1. Stáhněte `Remote-Desk-…-mac-universal.dmg`, otevřete ho a přetáhněte aplikaci do složky Aplikace.
2. Při prvním spuštění macOS aplikaci zablokuje, protože zatím není notarizovaná u Applu. Otevřete
   **Nastavení systému → Soukromí a zabezpečení** a dole klikněte na **Přesto otevřít**.
3. Pokud chcete, aby šlo tento Mac ovládat, povolte v aplikaci na stránce **Oprávnění**:
   - **Nahrávání obrazovky**, aby partner viděl obrazovku,
   - **Zpřístupnění**, aby mohl ovládat myš a klávesnici.

   Po povolení klikněte na **Restartovat aplikaci**. Oprávnění se nastavují jen jednou.

Pokud budete Mac jen používat k ovládání jiných počítačů, oprávnění potřeba nejsou.

## Nechat se ovládat

1. Otevřete Remote Desk. Na kartě **Povolit vzdálené ovládání** je vaše **ID** (9 číslic) a **heslo**.
2. Pošlete obojí člověku, který se má připojit. Tlačítka s ikonou kopírování je vloží do schránky.
3. Když se partner připojí, aplikace ukáže jeho jméno a ID a varování před podvodníky. Vyberte:
   - **Povolit ovládání**: partner vidí obrazovku a ovládá myš i klávesnici,
   - **Jen sledování**: partner jen vidí obrazovku,
   - **Odmítnout**.
4. Během relace je nahoře černý panel, který zůstává nad všemi okny. Ukazuje, kdo je připojený a jak
   dlouho. Tlačítkem **Pozastavit ovládání** partnerovi ovládání dočasně vypnete, **Odpojit** relaci ukončí.
   Když sami pohnete myší, máte přednost a partnerovo ovládání se na chvíli zastaví.
5. Po relaci můžete vygenerovat nové heslo šrafovaným tlačítkem vedle hesla. Staré heslo pak přestane platit.

ID zůstává stejné, heslo se mění při každém spuštění aplikace.

## Ovládat jiný počítač

1. Ověřte, že na druhém počítači běží Remote Desk.
2. Na kartě **Ovládat vzdálený počítač** zadejte ID a heslo partnera a klikněte na **Připojit**.
3. Aplikace partnera vyhledá a počká, až připojení povolí.
4. Pak uvidíte jeho obrazovku. Kliknutím do obrazu převezmete myš i klávesnici.

Klávesové zkratky (Cmd+C, Ctrl+V…) se posílají na vzdálený počítač. Mezi Macem a Windows se Cmd
a Ctrl automaticky prohodí, takže kopírování funguje tak, jak jste zvyklí.

Psaný text se přenáší přesně včetně diakritiky, bez ohledu na rozložení klávesnice na druhé straně.

Nedávná připojení jsou dole na hlavní stránce. Tlačítko **Připojit** předvyplní ID, stačí zadat heslo.

Pokud vám partner povolí jen sledování nebo ovládání pozastaví, uvidíte v liště oranžový štítek
„Ovládání vypnul partner“.

### Vaše jméno

V **Nastavení → Vaše jméno** si můžete zadat jméno, které partner uvidí v dialogu při připojení.
Je to nepovinné; bez jména se zobrazí jen vaše ID.

## Oblíbené: připojení bez hesla

Pro vlastní počítače nebo lidi, kterým pomáháte často:

1. Během připojení klikněte v liště na **hvězdičku**. Můžete také kliknout na hvězdičku u počítače
   v **Nedávných připojeních** a připojit se heslem; žádost se odešle po připojení.
2. Někdo u druhého počítače ji schválí (**Povolit ovládání** nebo **Jen sledovat**). Dokud je otázka
   otevřená, vzdálené ovládání je pozastavené, takže ji nejde schválit z vaší strany.
3. Počítač se objeví v **Oblíbených** pod polem ID. Klikněte na něj a jste tam: bez hesla a bez
   dotazu. Když zadáte jeho ID, pole pro heslo se také schová. Panel relace připojení na druhém
   počítači stále ukazuje.
4. Aby se šlo připojit, i když u počítače nikdo není, zapněte v jeho Nastavení **Spouštět po
   přihlášení a běžet na pozadí**. Po zavření okna pak Remote Desk běží dál v liště nahoře (Mac)
   nebo v oznamovací oblasti (Windows).
5. Oblíbené fungují jedním směrem. Pro připojení opačně přidejte oblíbený počítač i z druhé strany.
6. Přístup zrušíte na tom počítači v **Nastavení → Kdo má tento počítač v oblíbených**. Tlačítko
   **Odebrat vše a vyměnit klíč** ho sebere všem zařízením najednou.

Připojení používá zvláštní klíč, který vašemu zařízení předá druhý počítač. Ukládá se šifrovaně
klíčem, který z aplikace nejde vytáhnout, a sám nestačí: vaše zařízení musí navíc prokázat,
že vlastní svůj soukromý klíč.

## Lišta během relace

Lišta je nahoře uprostřed okna. Po chvíli se schová a znovu se ukáže, když najedete myší k hornímu okraji.

| Tlačítko | Co dělá |
| --- | --- |
| Rámeček | Přepíná mezi **přizpůsobit oknu** a **skutečnou velikostí**. Ve skutečné velikosti se obraz posouvá, když najedete k okraji. |
| Šipky ven | **Celá obrazovka**. |
| Dva monitory | **Monitor**, jen když má vzdálený počítač víc monitorů. Zobrazí jeden monitor (nejostřejší obraz), nebo **všechny monitory vedle sebe** tak, jak jsou na tom počítači uspořádané. Vedle sebe můžete okno přetáhnout z jednoho monitoru na druhý; štítek nad monitorem přepne zpět jen na něj. Volba se pro daný počítač pamatuje. |
| Tachometr | **Kvalita**: automaticky, upřednostnit rychlost (pro slabou síť), nebo upřednostnit kvalitu. |
| Oko | **Jen sledovat**: obraz vidíte, ale myš a klávesnice se neposílají. |
| Klávesnice | **Odeslat zkratku**, kterou by jinak zachytil váš vlastní systém (Alt+Tab, Win, Cmd+Tab, Spotlight…). |
| Schránka | **Sdílená schránka** zapnout/vypnout. Když je zapnutá, text zkopírovaný na jednom počítači vložíte na druhém (jen při povoleném ovládání). |
| Šipka nahoru | **Odeslat soubory** na vzdálený počítač. Soubory můžete i přetáhnout do obrazu. Uloží se tam do Stažených souborů (max. 500 MB na soubor). |
| Šipka dolů | **Stáhnout soubory** ze vzdáleného počítače. Na vzdálené ploše se otevře výběr souborů; vyberte je tam a uloží se k vám do Stažených souborů. Když na vzdáleném počítači soubor zkopírujete (Ctrl/Cmd+C), lišta nabídne tlačítko **Stáhnout**. |
| Fotoaparát | **Uložit snímek** vzdálené obrazovky jako PNG. |
| Připínáček | Lišta zůstane trvale zobrazená. |
| Křížek | **Odpojit**. |

Vlevo na liště je stav spojení: odezva v milisekundách, počet snímků za sekundu, datový tok a jestli
spojení vede **přímo**, nebo **přes relé**. Zelená tečka znamená rychlé spojení, oranžová průměrné,
červená pomalé.

## Nastavení

### Jazyk a vzhled

Jazyk je čeština, nebo angličtina, výchozí podle systému. Přepínač světlého a tmavého režimu je vpravo nahoře.

### Síť

- **Veřejná síť** (výchozí): počítače se najdou přes veřejné Nostr relaye. Nic nenastavujete.
  Relaye předávají jen šifrovaný úvod spojení, nikoli obraz ani heslo.
- **Vlastní server**: pokud nechcete záviset na veřejných relayích, spusťte si vlastní
  (viz [README](../README.md#own-server-optional)) a zadejte jeho adresu, např. `wss://relay.example.com`.

Oba počítače musí mít stejné nastavení sítě, jinak se nenajdou.

### Diagnostika

Záznam toho, co aplikace dělala: připojení a jejich cesta (přímo, nebo přes relé), chyby snímání
obrazovky, oprávnění, aktualizací a přenosu souborů. **Zobrazit soubor** otevře jeho složku
(`~/Library/Logs/Remote Desk` na macOS, `%APPDATA%\Remote Desk\logs` na Windows).

### TURN relé

Většina spojení vede přímo mezi počítači. Na mobilních datech nebo v přísných firemních sítích to ale
nemusí jít. V takovém případě pomůže TURN relé, které spojení přenese. Zadejte jeho adresu, uživatele
a heslo. Můžete použít vlastní (např. [coturn](https://github.com/coturn/coturn)), nebo hostovanou službu.

## Bezpečnost

- **Nikdy nedávejte ID a heslo nikomu, kdo vám sám zavolal nebo napsal.** Banky, Microsoft, policie
  ani poskytovatel internetu po vás vzdálený přístup nechtějí. Jde o častý podvod.
- Bez vašeho kliknutí na **Povolit** se nikdo nepřipojí.
- Heslo se nikam neposílá. Slouží jako klíč, kterým se šifruje navázání spojení.
- Obraz a ovládání jdou přímo mezi počítači a jsou šifrované (WebRTC, DTLS-SRTP).
- Najednou se může připojit jen jeden člověk.
- Po relaci si vygenerujte nové heslo.

## Když něco nefunguje

Přesný důvod chyby najdete v **Nastavení → Diagnostika**; otevře ji i odkaz **Podrobnosti** u
chybové hlášky. **Kopírovat** vloží log do schránky pro hlášení chyby. Hesla, klíče ani obsah
schránky se do něj nikdy nezapisují a ID partnerů jsou zkrácená.

**„Nepodařilo se připojit“**
- Zkontrolujte ID a heslo. Heslo se mění při každém spuštění aplikace.
- Ověřte, že na druhém počítači běží Remote Desk a je **Online** (karta Připojení vlevo dole).
- Oba počítače musí mít v Nastavení stejnou síť.
- Na mobilních datech nebo ve firemní síti nastavte TURN relé.

**Obraz je pomalý nebo trhaný**
- V liště zvolte **Kvalita → Upřednostnit rychlost**.
- Pokud stav ukazuje „přes relé“, spojení jde přes TURN a bývá pomalejší.

**Na Macu vidím černou obrazovku nebo nejde ovládat**
- Ovládaný Mac musí mít povolené Nahrávání obrazovky a Zpřístupnění (stránka **Oprávnění**)
  a po povolení je potřeba aplikaci restartovat.
- Pokud oprávnění v Nastavení vypadá zapnuté, ale aplikace hlásí, že chybí, klikněte na stránce
  Oprávnění na **Opravit**. Stará položka se smaže a macOS se zeptá znovu.

**Na Windows nejde ovládat okno správce nebo dialog „Řízení uživatelských účtů“**
- To je známé omezení. Windows nedovolí běžné aplikaci ovládat okna spuštěná jako správce.
