# Návod k Remote Desk

[English version](guide.md)

Remote Desk umožňuje ovládat jiný počítač na dálku, nebo nechat někoho ovládat ten váš. Bez účtu
a bez vlastního serveru – stačí ID a heslo, u oblíbených počítačů jedno kliknutí.

## Obsah

1. [Co aplikace umí](#co-aplikace-umí)
2. [Instalace a aktualizace](#instalace-a-aktualizace)
3. [Nechat se ovládat](#nechat-se-ovládat)
4. [Ovládat jiný počítač](#ovládat-jiný-počítač)
5. [Oblíbené: připojení bez hesla](#oblíbené-připojení-bez-hesla)
6. [Přístup k počítači, když nejste doma](#přístup-k-počítači-když-nejste-doma)
7. [Lišta během relace](#lišta-během-relace)
8. [Schránka a soubory](#schránka-a-soubory)
9. [Nastavení](#nastavení)
10. [Bezpečnost](#bezpečnost)
11. [Když něco nefunguje](#když-něco-nefunguje)

## Co aplikace umí

- Ovládat počítač s Windows nebo Mac z druhého systému, oběma směry.
- Připojit se pomocí ID a hesla, nebo jedním kliknutím k počítačům v **Oblíbených**, i z ikony
  v liště nahoře / v oznamovací oblasti a z Docku.
- Dostat se ke svému počítači odkudkoli (škola, práce, mobilní data), když běží na pozadí a neusne.
- Ostrý obraz (1920 px až při 60 fps) včetně **zvuku** vzdáleného počítače.
- **Více monitorů**: jeden po druhém, nebo všechny vedle sebe.
- **Sdílenou schránku** a **přenos souborů** oběma směry.
- Ochranu proti podvodníkům, **diagnostický log** a **automatické aktualizace**.
- Češtinu i angličtinu, světlý a tmavý vzhled.

## Instalace a aktualizace

Instalační soubor stáhnete na stránce [Releases](../../../releases).

### Windows

1. Stáhněte `Remote-Desk-…-win-x64.exe` (pro počítače s ARM `arm64`).
2. Spusťte ho. Aplikace se nainstaluje jedním kliknutím a rovnou otevře.
3. Aplikace zatím není digitálně podepsaná, takže Windows SmartScreen může ukázat „Systém Windows
   ochránil váš počítač“. Klikněte na **Další informace → Přesto spustit**.

Windows žádná další oprávnění nepotřebují.

### macOS

1. Stáhněte `Remote-Desk-…-mac-universal.dmg`, otevřete ho a přetáhněte aplikaci do Aplikací.
   Když ji spustíte odjinud, sama nabídne přesun (je potřeba kvůli aktualizacím).
2. Při prvním spuštění ji macOS zablokuje, protože zatím není ověřená Applem. Otevřete
   **Nastavení systému → Soukromí a zabezpečení** a klikněte na **Přesto otevřít**.
3. Pokud má jít tento Mac ovládat, povolte na stránce **Oprávnění** v aplikaci:
   - **Záznam obrazovky**, aby partner viděl obrazovku,
   - **Zpřístupnění**, aby mohl ovládat myš a klávesnici.

   Pak klikněte na **Restartovat aplikaci**. Stačí to udělat jednou, oprávnění vydrží i po aktualizacích.
4. Když bude Mac poprvé sdílet zvuk (macOS 14.2 a novější), macOS se zeptá, jestli smí Remote Desk
   nahrávat zvuk systému.

Pokud Mac používáte jen k ovládání jiných počítačů, žádná oprávnění nepotřebuje.

### Aktualizace

Aplikace hledá aktualizace sama. Jakmile je nějaká připravená, na hlavní stránce se objeví oranžový
pruh a tlačítko **Stáhnout aktualizaci** / **Restartovat a aktualizovat** na stránce **Novinky**
zoranžoví. Po restartu se aktualizace nainstaluje na Windows i na macOS. **Zkontrolovat** hledá
aktualizaci hned, **Co je nového** ukazuje změny v jednotlivých verzích.

## Nechat se ovládat

1. Otevřete Remote Desk. Na kartě **Povolit vzdálené ovládání** je vaše **ID** (9 číslic) a **heslo**.
2. Pošlete obojí člověku, který se má připojit. Tlačítka s ikonou kopírování je vloží do schránky.
3. Když se připojí, aplikace ukáže jeho jméno, ID a varování před podvodníky. Vyberte:
   - **Povolit ovládání**: vidí obrazovku a ovládá myš i klávesnici,
   - **Jen sledovat**: obrazovku jen vidí,
   - **Odmítnout**.

   Zaškrtávátko pod tím dovolí tomuto zařízení přidat si váš počítač do **oblíbených**, takže se
   příště připojí bez hesla a bez dotazu. Když do minuty nikdo neodpoví, žádost se odmítne.
4. Během relace je nad všemi okny černý panel s tím, kdo je připojený a jak dlouho.
   **Pozastavit ovládání** dočasně vypne jeho vstup, **Odpojit** relaci ukončí.
   Když pohnete vlastní myší, máte přednost a jeho ovládání se na chvíli zastaví.
5. Po skončení si šrafovaným tlačítkem vedle hesla vytvořte nové. Staré přestane platit.

ID zůstává stejné, heslo se mění při každém spuštění aplikace.

## Ovládat jiný počítač

1. Ověřte, že na druhém počítači běží Remote Desk.
2. Na kartě **Ovládat vzdálený počítač** zadejte ID partnera (při psaní se dělí po trojicích)
   a heslo a klikněte na **Připojit**. Tlačítkem s okem si heslo zobrazíte a zkontrolujete.
3. Aplikace partnera vyhledá a počká, až připojení povolí.
4. Pak uvidíte jeho obrazovku. Kliknutím do obrazu převezmete myš i klávesnici.

Klávesové zkratky (Cmd+C, Ctrl+V…) se posílají na vzdálený počítač. Mezi Macem a Windows se Cmd
a Ctrl automaticky prohodí, takže kopírování funguje tak, jak jste zvyklí.

Psaný text se přenáší přesně včetně diakritiky, bez ohledu na rozložení klávesnice na druhé straně.

Nedávná připojení jsou dole na hlavní stránce. Tlačítko **Připojit** předvyplní ID, stačí zadat heslo.
Hvězdička vedle počítače požádá o jeho přidání do oblíbených.

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
3. Hvězdička se vyplní a počítač se objeví v **Oblíbených** pod polem ID. Klikněte na něj a jste tam:
   bez hesla a bez dotazu. Když zadáte jeho ID, pole pro heslo se také schová; **Zadat heslo** ho
   vrátí. Panel relace připojení na druhém počítači stále ukazuje.
4. Oblíbené fungují jedním směrem. Pro připojení opačně přidejte oblíbený počítač i z druhé strany.
5. U sebe oblíbený počítač odeberete křížkem vedle něj nebo vyplněnou hvězdičkou. Na druhém počítači
   přístup zrušíte v **Nastavení → Kdo má tento počítač v oblíbených**. Tlačítko **Odebrat vše
   a vyměnit klíč** ho sebere všem zařízením najednou.

Připojení používá zvláštní klíč, který vašemu zařízení předá druhý počítač. Ukládá se šifrovaně
klíčem, který z aplikace nejde vytáhnout, a sám nestačí: vaše zařízení musí navíc prokázat,
že vlastní svůj soukromý klíč.

## Přístup k počítači, když nejste doma

Například ovládání domácího PC ze školy. Na počítači, ke kterému se chcete připojovat:

1. Přidejte si ho do **Oblíbených** (viz výše), dokud jste oba doma, abyste nepotřebovali jeho heslo.
2. V **Nastavení** zapněte **Spouštět po přihlášení a běžet na pozadí**. Remote Desk se pak spustí se
   systémem a po zavření okna běží dál v liště nahoře (Mac) nebo v oznamovací oblasti (Windows).
   Ukončíte ho přes tuto ikonu.
3. Zapněte **Nedovolit uspání počítače**. Počítač neusne, takže zůstane dostupný; obrazovka se vypnout
   může. U notebooku ho může uspat zavření víka.
4. Nechte počítač zapnutý a přihlášený. Remote Desk neumí probudit vypnutý ani uspaný počítač
   a na Windows neovládne přihlašovací obrazovku.

**Soukromá obrazovka (Windows):** aby doma nikdo neviděl, co děláte, zapněte v Nastavení toho počítače
**Dovolit oblíbeným zatemnit tuto obrazovku**. Když jste připojení jako oblíbené zařízení, tlačítko
s monitorem v liště pak jeho monitory zatemní; vy vidíte vše jako dřív. Jakmile tam někdo pohne
myší, obrazovka se hned zobrazí.

**Odkazy:** pravým tlačítkem na oblíbený počítač zkopírujete odkaz `remotedesk://connect/<ID>`. Jeho
otevření vás rovnou připojí, takže ho můžete použít ve Zkratkách na Macu (i přes Siri), v Raycastu,
Alfredu, na Stream Decku nebo jako zástupce na ploše. Odkaz na počítač mimo oblíbené jen vyplní ID.

Na cestách funguje i připojení přes mobilní data. Ostrý obraz spotřebuje zhruba 3–5 GB za hodinu,
**Kvalita → Šetřit data** výrazně méně.

## Lišta během relace

Lišta je nahoře uprostřed okna. Po chvíli se schová a objeví se, když najedete myší k hornímu okraji.

| Tlačítko | Co dělá |
| --- | --- |
| Hvězdička | **Přidat do oblíbených**: příště se připojíte bez hesla. Člověk u druhého počítače to schválí. Vyplněná hvězdička počítač z oblíbených odebere. |
| Rámeček | Přepíná mezi **přizpůsobit oknu** a **skutečnou velikostí**. Ve skutečné velikosti se obraz posouvá, když najedete k okraji. |
| Šipky ven | **Celá obrazovka**. |
| Dva monitory | **Monitor**, jen když má vzdálený počítač víc monitorů. Zobrazí jeden monitor (nejostřejší obraz), nebo **všechny monitory vedle sebe** tak, jak jsou na tom počítači uspořádané. Vedle sebe můžete okno přetáhnout z jednoho monitoru na druhý; štítek nad monitorem přepne zpět jen na něj. Volba se pro daný počítač pamatuje. |
| Tachometr | **Kvalita**. **Automaticky** drží ostrých 1920 px a když síť nebo počítač nestíhá, ubere snímky (60 → 30 fps). **Upřednostnit plynulost** drží 60 fps při 1280 px pro slabou síť. **Maximální ostrost** posílá plné rozlišení při 30 fps. **Šetřit data** drží 1920 px při nejvýš 30 fps a asi 3 Mbit/s, pro mobilní data. Volba se pamatuje. |
| Monitor s čárou | **Soukromá obrazovka**: zatemní monitory vzdáleného počítače. Jen pro oblíbené, na Windows a když to jeho majitel povolil. |
| Reproduktor | **Zvuk** vzdáleného počítače: přehrávat, nebo u vás ztlumit. Volba se pamatuje. Windows zvuk sdílí vždy; Mac potřebuje macOS 14.2 nebo novější a poprvé se zeptá na povolení. |
| Oko | **Jen sledovat**: obraz vidíte, ale myš a klávesnice se neposílají. |
| Klávesnice | **Odeslat zkratku**, kterou by jinak zachytil váš systém (Alt+Tab, Win, Cmd+Tab, Spotlight…). |
| Schránka | **Sdílená schránka** zapnout/vypnout. |
| Šipka nahoru | **Odeslat soubory** na vzdálený počítač. |
| Šipka dolů | **Stáhnout soubory** ze vzdáleného počítače. |
| Fotoaparát | **Uložit snímek** vzdálené obrazovky jako PNG. |
| Špendlík | Nechá lištu stále zobrazenou. |
| Křížek | **Odpojit**. |

Vlevo lišta ukazuje, co skutečně dorazí: odezvu, rozlišení, snímky za sekundu, datový tok a jestli
je spojení **přímé**, nebo **přes relé**. Zelená tečka znamená rychlé spojení, oranžová průměrné,
červená pomalé.

## Schránka a soubory

Všechno tohle funguje jen při povoleném ovládání (ne v režimu Jen sledovat ani při pozastavení).

- **Schránka**: text zkopírovaný na jednom počítači vložíte na druhém, oběma směry. Vypnete ji
  tlačítkem schránky v liště.
- **Odeslat soubory** na vzdálený počítač: přetáhněte je do obrazu, nebo použijte tlačítko se šipkou
  nahoru. Uloží se tam do Stažených souborů a ten počítač ukáže oznámení. Nejvýš 500 MB na soubor.
- **Stáhnout soubory** ze vzdáleného počítače:
  - zkopírujte tam soubor (Ctrl/Cmd+C) a lišta nabídne tlačítko **Stáhnout**, nebo
  - klikněte na tlačítko se šipkou dolů a vyberte soubory ve výběru, který se otevře na vzdálené ploše.

  Uloží se k vám do Stažených souborů; kliknutím na zprávu v liště soubor zobrazíte.

## Nastavení

### Vaše jméno, jazyk a vzhled

Jméno, které partner uvidí, a jazyk (čeština nebo angličtina, výchozí podle systému). Přepínač
světlého a tmavého vzhledu je vpravo nahoře.

### Kdo má tento počítač v oblíbených

Zařízení, která se k tomuto počítači připojí bez hesla a bez dotazu. Odebráním zařízení mu přístup
hned seberete, nebo použijte **Odebrat vše a vyměnit klíč**.

### Připojení k tomuto počítači

Kdo se připojil, kdy, na jak dlouho, jestli s ovládáním nebo jen se sledováním a jestli jako oblíbené
zařízení, nebo s heslem. Při každém připojení se navíc ukáže oznámení. Ukládá se jen v tomto počítači.

### Dovolit oblíbeným zatemnit tuto obrazovku (Windows)

Viz soukromá obrazovka v [Přístup k počítači, když nejste doma](#přístup-k-počítači-když-nejste-doma).
Na počítačích, které používají i jiní lidé, to nechte vypnuté.

### Běh na pozadí a nedovolit uspání

Viz [Přístup k počítači, když nejste doma](#přístup-k-počítači-když-nejste-doma).

### Ikona v liště nahoře / v oznamovací oblasti

Zobrazí se při běhu na pozadí, nebo vždy, když zapnete **Zobrazit ikonu v liště nahoře / v oznamovací
oblasti**. Z její nabídky se jedním kliknutím připojíte k oblíbenému počítači, zkopírujete své ID nebo
heslo pro toho, kdo se má připojit k vám, uvidíte probíhající relaci s tlačítkem **Odpojit** a aplikaci
otevřete nebo ukončíte. Na Macu jsou oblíbená a kopírování i v nabídce v Docku (pravé tlačítko na ikoně
Remote Desk).

### Síť

- **Veřejná síť** (výchozí): počítače se najdou přes veřejné Nostr relé. Nic se nenastavuje.
  Relé předávají jen zašifrované navázání spojení, nikdy obraz ani heslo.
- **Vlastní server**: pokud nechcete záviset na veřejných relé, spusťte si vlastní
  (viz [README](../README.md#own-server-optional)) a zadejte jeho adresu, např. `wss://relay.example.com`.

Oba počítače musí mít stejné nastavení sítě, jinak se nenajdou.

### TURN relé

Většina spojení jde přímo mezi počítači, i přes mobilní data. V přísných firemních nebo školních
sítích to nemusí jít; spojení pak přenese TURN relé. Zadejte jeho adresu, uživatele a heslo na obou
počítačích. Můžete použít vlastní (např. [coturn](https://github.com/coturn/coturn)) nebo hotovou
službu. Relé obraz nezlepší, pomůže jen tam, kde přímé spojení selže.

### Diagnostika

Záznam toho, co aplikace dělala: připojení a jejich cesta (přímo, nebo přes relé), chyby snímání
obrazovky, oprávnění, zvuku, aktualizací a přenosu souborů. **Kopírovat** vloží log do schránky,
**Zobrazit soubor** otevře jeho složku (`~/Library/Logs/Remote Desk` na macOS,
`%APPDATA%\Remote Desk\logs` na Windows). Hesla, klíče ani obsah schránky se do něj nikdy nezapisují
a ID partnerů jsou zkrácená, takže ho můžete vložit do hlášení chyby.

### Zpětná vazba

Na stránce **Novinky** otevřou **Nahlásit chybu** a **Navrhnout vylepšení** formulář na GitHubu
s vyplněnou verzí aplikace.

## Bezpečnost

- **Nikdy nedávejte ID a heslo nikomu, kdo vám sám zavolal nebo napsal.** Banka, Microsoft, policie
  ani poskytovatel internetu o vzdálený přístup nikdy nežádají. Je to častý podvod.
- Nikdo se nepřipojí, dokud nekliknete na **Povolit**, kromě zařízení, která jste si sami přidali do oblíbených.
- Při schvalování oblíbených je vzdálené ovládání pozastavené, takže za vás druhá strana Povolit
  nekline. Nezodpovězené dotazy se po minutě samy zavřou jako Odmítnout.
- Soukromá obrazovka funguje jen pro oblíbené, jen když ji povolíte, a pohyb myší u počítače ji vždy
  zruší. Každé připojení je v Nastavení s oznámením.
- Panel relace vždy ukazuje, kdo je připojený; pohyb vlastní myší má přednost.
- Heslo se nikam neposílá. Je to klíč, kterým se šifruje navázání spojení.
- Obraz, zvuk i ovládání jdou přímo mezi počítači a jsou šifrované (WebRTC, DTLS-SRTP).
- Jiné programy v počítači nemohou spustit Remote Desk v ladicím režimu a zneužít jeho oprávnění.
- Připojený může být vždy jen jeden člověk.
- Po každé relaci si vytvořte nové heslo.

## Když něco nefunguje

Přesný důvod chyby najdete v **Nastavení → Diagnostika**; otevře ji i odkaz **Podrobnosti** u
chybové hlášky.

**„Nepodařilo se připojit“**
- Zkontrolujte ID a heslo. Heslo se mění při každém spuštění aplikace.
- Ověřte, že na druhém počítači běží Remote Desk a je **Online** (karta Připojení vlevo dole).
- Oba počítače musí mít v Nastavení stejnou síť.
- V přísných firemních nebo školních sítích nastavte TURN relé, nebo zkuste mobilní data.

**Oblíbený počítač nejde zastihnout**
- Druhý počítač je vypnutý, uspaný nebo na něm neběží Remote Desk: viz
  [Přístup k počítači, když nejste doma](#přístup-k-počítači-když-nejste-doma).
- Už vás nemá v oblíbených: připojte se pomocí ID a hesla a přidejte si ho znovu.

**Obraz je pomalý nebo trhaný**
- V liště zvolte **Kvalita → Upřednostnit plynulost**, na mobilních datech **Šetřit data**.
- Automaticky při 1920 px a 60 fps potřebuje na ovládaném počítači asi 8–16 Mbit/s uploadu.
- Pokud lišta ukazuje „přes relé“, spojení jde přes TURN a bývá pomalejší.

**Není slyšet zvuk**
- Zkontrolujte tlačítko s reproduktorem v liště.
- Ovládaný Mac potřebuje pro zvuk macOS 14.2 nebo novější a povolené nahrávání zvuku systému.
  V Diagnostice je „sharing system sound“, nebo „system sound not available“.

**Na Macu je černá obrazovka nebo nejde ovládat**
- Ovládaný Mac potřebuje Záznam obrazovky a Zpřístupnění (stránka **Oprávnění**) a po jejich povolení
  je potřeba aplikaci restartovat.
- Pokud oprávnění v Nastavení systému vypadá zapnuté, ale aplikace hlásí, že chybí, klikněte na stránce
  Oprávnění na **Opravit**. Starý záznam se odstraní a macOS se zeptá znovu.

**Aktualizace se nenainstaluje**
- Ukončete Remote Desk přes ikonu v liště nebo v oznamovací oblasti, pár sekund počkejte a znovu ho
  otevřete; stažená aktualizace se nainstaluje při ukončení aplikace.

**Na Windows nejdou ovládat okna správce ani dotaz Řízení uživatelských účtů**
- Jde o známé omezení: Windows nedovolí běžné aplikaci ovládat okna spuštěná jako správce ani
  přihlašovací obrazovku.
