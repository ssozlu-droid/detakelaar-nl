# DeTakelaar.nl

HTML/CSS/JavaScript-website zonder build, database, API-sleutel of npm-installatie. De optionele actuele filemeldingen en autonieuwskoppen gebruiken de PHP-koppeling in `api/`: PHP 8+, cURL, DOM/XMLReader en zlib zijn daarvoor nodig. Zie LIVE-PUBLICATIE.md. Bij ontbrekende of onbruikbare brondata blijft de gouden kaart zichtbaar en verschijnt een nette niet-beschikbaarmelding. Telefoon en WhatsApp: 06 8299 0303, door eigenaar opgegeven. Contactinstellingen staan in config.js.

## Lokaal gebruiken

Gebruik de bestaande checkout; maak voor cloudtaken geen extra Git-worktree tenzij hierom gevraagd wordt.

```
cd /workspace/detakelaar-nl
python3 -m http.server 8000 --bind 0.0.0.0
```

Open de site via een lokale HTTP-server op je eigen computer. Open index.html niet rechtstreeks met file://: JavaScriptmodules kunnen dan worden geblokkeerd. In de cloud wordt localhost alleen intern getest.

Voor de live-koppelingen: start vanuit de checkout `php -S 0.0.0.0:8000 -t .` (`npm run start:live`). De Python-server hierboven is geschikt voor de statische site, maar voert geen PHP uit.

Tests: `npm test` (Node 24). Backendtests: `php tests/live-data.test.php`. De test `python3 tests/live-browser.py` gebruikt expliciet gesimuleerde feeds; start daarvoor eerst PHP op poort 8001. Deze tests bewijzen geen live bronbeschikbaarheid. Browsercontrole: `python3 tests/browser_smoke.py` vereist Python Playwright en Chromium op /usr/bin/chromium. De browsertest start zelf tijdelijk een server op poort 8000. RDW-antwoorden worden daarin gesimuleerd. Een geslaagde browsertest bewijst geen live beschikbaarheid van de RDW.

## Publiceren op TransIP

1. Download eerst een complete back-up van de huidige webmap én exporteer de WordPress-database via de beschikbare hostingtools. Bewaar ook verborgen bestanden zoals .htaccess. Verwijder niets voordat je hebt gecontroleerd dat de back-up bruikbaar is.
2. Controleer in het TransIP-controlepaneel welk hostingpakket aan detakelaar.nl hangt en welke documentroot daarvoor geldt. Gebruik het precieze pad van TransIP; raad geen mapnaam. Controleer dat www en het hoofddomein naar de bedoelde hosting verwijzen. Verander geen mailrecords bij een websitewijziging.
3. Pak detakelaar-website.zip lokaal uit. Upload de INHOUD naar de documentroot, niet een extra bovenliggende map. Vereist: index.html, privacy.html, styles.css, app.js, vehicle.js, config.js en de map assets. README mag je lokaal bewaren.
4. Test eerst expliciet https://detakelaar.nl/index.html en https://detakelaar.nl/assets/logo.svg. Bij 404: controleer documentroot, hoofdlettergebruik, bestandsnaam, eventuele dubbele mappen en de hostingkoppeling. WordPress op zichzelf bewijst niet dat het bestand geblokkeerd wordt.
5. Werkt /index.html maar toont / nog WordPress? Controleer dan de standaardindexvolgorde en redirects via TransIP. Laat na een back-up de statische index prioriteit krijgen via ondersteunde hostinginstellingen. Wijzig .htaccess uitsluitend na onderzoek en met een herstelkopie; overschrijf geen bestaande regels blind.
6. Controleer HTTPS-certificaat en eventuele doorverwijzing van www naar het hoofddomein. Controleer ook redirects en caches. Gebruik geen IP-adres als vervanging voor een domeintest: virtuele hosting kan dan een andere site tonen.
7. Test op je telefoon: kenteken zoeken, onbekend kenteken, verbindingstoring, aanvraag invullen, WhatsApp openen en belknop. Controleer dat WhatsApp het juiste bedrijfsaccount toont. Verstuur pas een echt testbericht als je dat zelf wilt.

## Nog vóór commerciële publicatie controleren

- Live RDW-aanroep vanaf het uiteindelijke domein, inclusief CORS en ontbrekende gegevens. Endpoint: https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=KENTEKEN. De cloudproxy blokkeerde deze bestemming tijdens ontwikkeling; er zijn geen live voertuigresultaten bevestigd.
- Bevestig hosting, DNS, SSL, documentroot en bestaande WordPress-configuratie met echte TransIP-gegevens. Er is tijdens ontwikkeling niets op TransIP gewijzigd of gepubliceerd.
- Privacytekst aanvullen op basis van de werkelijke bedrijfsgegevens, hostinglogs, bewaring en werkwijze. Het formulier slaat lokaal niets op; WhatsApp en hostinglogs hebben hun eigen verwerking.
- Voeg indien van toepassing correcte KvK-, btw- en adresgegevens toe. Er zijn geen gegevens verzonnen. info@detakelaar.nl wordt pas als contactadres toegevoegd wanneer de mailbox werkt.
- Een echte bedrijfsfoto kan later worden toegevoegd. Er worden geen fictieve voertuigfoto's, verzekeringsclaims of 24/7-beloften gebruikt.

## Architectuur

vehicle.js bevat normalisatie, de RDW-provider en berichtopmaak. app.js beheert de interface met textContent voor externe voertuiggegevens. Een toekomstige Finnik-koppeling hoort achter een serveradapter zodra toegang en voorwaarden bekend zijn; plaats nooit privésleutels in frontendbestanden. De toegestane maximummassa van de oprijwagen is niet de laadcapaciteit. Voertuiggeschiktheid wordt persoonlijk beoordeeld.
