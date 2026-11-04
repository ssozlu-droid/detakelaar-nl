# Filemeldingen en actueel autonieuws

De bestaande gouden achtergrondkaart blijft behouden. `live-updates.js` tekent
rode filetracés of rode punten over die kaart, met dezelfde Mercatorprojectie en
plaatsing op desktop en mobiel. Het blok **Verkeer & autonieuws** geeft bron,
tijdstip, dekking en maximaal drie recente nieuwskoppen.

## Bronnen en grenzen

- Verkeer: NDW `https://opendata.ndw.nu/actueel_beeld.xml.gz`, DATEX II
  SituationPublication. Geen API-sleutel. Alleen actieve AbnormalTraffic-meldingen
  met een expliciet filetype en bruikbare GML-lijn of WGS84-puntlocatie.
  Puntlocaties worden nooit omgezet in een verzonnen filetracé. Een weggefilterde
  melding zonder geometrie wordt als niet-tekenbare melding geteld.
- Nieuws: `https://www.nu.nl/rss/Auto`. Alleen koppen, bronvermelding,
  publicatiedatum en een link naar het oorspronkelijke artikel. Geen gekopieerde
  artikelen of afbeeldingen. Alleen nieuws van maximaal 72 uur oud.
- De kaart is een gegeneraliseerd overzicht; niet ieder wegvak of elke file is
  gedekt. Een gouden weg is geen verklaring dat die weg filevrij is.
- De NDW-publicatietijd, niet de downloadtijd, bepaalt de actualiteit. Na vijf
  minuten verdwijnen rode meldingen. Een onbereikbare of ongeldige bron geeft
  geen oude filelijnen terug. Bij een fout verschijnt expliciet een melding.
- Verkeersupdates elke minuut, gedeelde servercache 60 seconden. Nieuwscontrole
  elke tien minuten. PHP-cachebestanden staan onder de tijdelijke servermap,
  buiten `/www`; er is geen cronjob of database nodig. Een korte negatieve cache
  voorkomt herhaalde aanvragen tijdens storingen.

## Publiceren op TransIP

Laat de bestaande `.htaccess` intact. Upload via de bestaande handmatige werkwijze:

| Bestand | Pad |
| --- | --- |
| `index.html` | `/www/index.html` |
| `styles.css` | `/www/styles.css` |
| `live-updates.js` | `/www/live-updates.js` |
| `api/live-lib.php` | `/www/api/live-lib.php` |
| `api/traffic.php` | `/www/api/traffic.php` |
| `api/news.php` | `/www/api/news.php` |

De overige bestaande bestanden en afbeeldingen blijven nodig. De tests en tools
hoeven niet op de hosting. Maak geen nieuwe `.htaccess` voor deze functionaliteit.

Vereist: actieve PHP 8+ met cURL, DOM, XMLReader en zlib; uitgaand HTTPS naar
`opendata.ndw.nu` en `www.nu.nl`; een schrijfbare tijdelijke PHP-map. TLS-controle
blijft aan. Er worden geen sleutels gevraagd of in browsercode opgeslagen.

Controleer na de upload:

1. `https://detakelaar.nl/api/traffic.php` geeft JSON. Bij succes: `status: ok`,
   een actuele `sourceUpdatedAt`, `expiresAt` en `jams`. Een lege `jams` is alleen
   geldig bij een echt actuele, correct gelezen bronpublicatie.
2. `https://detakelaar.nl/api/news.php` geeft JSON met recente `publishedAt`-datums.
   HTTP 503 met `status: unavailable` betekent dat de bron of PHP-vereisten niet
   bruikbaar zijn; dat is geen succesvolle live koppeling.
3. Verschijnt PHP-broncode, HTML van WordPress of een 404 in plaats van JSON,
   controleer PHP-activatie en het exacte `/www/api/`-pad in TransIP. Upload geen
   sleutels en overschrijf `.htaccess` niet om dit te omzeilen.
4. Vernieuw de homepage met Ctrl+F5 en controleer desktop én mobiel, de bronlinks,
   tijdstempels en de rode locaties. Controleer ook kentekencheck en WhatsApp.

## Ontwikkelen en testen

Gebruik de bestaande checkout, zonder extra worktree. Statische ontwikkeling kan
met de bestaande Python-server. Voor echte PHP-endpoints:

```
php -S 127.0.0.1:8001 -t .
npm test
php tests/live-data.test.php
python3 tests/live-browser.py
```

In de voorbereide cloud is een geïsoleerde PHP 8.4-runtime beschikbaar als
`/workspace/.detakelaar-php/bin/php` (buiten de repository). Gebruik dat commando
als `php` niet in PATH staat. De tests controleren projectie, publicatietijden,
verlopen meldingen, punt/segmentonderscheid, XML/URL-veiligheid, caching,
nieuwsrecency en browserfoutafhandeling met expliciete testgegevens.

## Validatiestatus van deze wijziging

De parser-, cache-, JavaScript- en browsertests zijn lokaal met gesimuleerde
brondata uitgevoerd. De echte PHP-endpoints geven correct JSON/HTTP 503 bij een
geblokkeerde bron. De cloudproxy weigert momenteel toegang tot beide bronnen met
HTTP 403. Daarom zijn echte NDW-meldingen, de actuele RSS-inhoud en werking op
TransIP **nog niet bevestigd**. De cloudconfiguratie bevat een opgeslagen concept
met de benodigde domeinen; review, opslaan en publiceren daarvan zijn nog nodig
om de cloud-broncontrole af te ronden. Dit is iets anders dan publiceren op TransIP.

## Veilige foutcodes bij diagnose

De PHP-endpoints geven bij een storing ook een `code`, zonder serverpaden,
credentialwaarden of ruwe broninhoud:

- `PHP_CURL_MISSING` / `PHP_XML_MISSING`: vereiste PHP-module ontbreekt.
- `SOURCE_HTTP_403` / `SOURCE_HTTP_404` / `SOURCE_HTTP_301` enz.: de bron antwoordt
  met deze HTTP-status; onderzoek dat antwoord voordat de bron-URL wordt gewijzigd.
- `SOURCE_CONNECTION_FAILED`, `SOURCE_TIMEOUT` of `SOURCE_TLS_FAILED`: de
  uitgaande HTTPS-verbinding is niet bruikbaar. TLS-controle niet uitschakelen.
- `SOURCE_NOT_RSS` / `SOURCE_DATA_INVALID` / `SOURCE_FORMAT_INVALID`: het antwoord
  is geen bruikbare feed of bevat ongeldige gegevens.
- `CACHE_UNAVAILABLE`: de tijdelijke cachemap is niet schrijfbaar.

Ook een kort gecachte storing behoudt zijn foutcode. De gewone website toont
bezoekers alleen de rustige niet-beschikbaarmelding.

## Aanvullende broncontrole op TransIP

Op 4 november 2026 leverde de eigenaar het resultaat van `/api/traffic.php` aan:
`status: ok`, NDW-publicatie `2026-11-04T02:33:00Z`, controle
`2026-11-04T02:33:36Z`, vervaltijd `2026-11-04T02:38:00Z`, `jams: []` en
`unmappedReports: 0`. Dit bevestigt een actuele succesvolle NDW-endpointreactie
op TransIP op dat moment. Een niet-lege echte filepublicatie is nog niet
vastgelegd; de weergave daarvan is met gesimuleerde gegevens getest.
De nieuwsfeed gaf daar `SOURCE_HTTP_404`; verder werk aan nieuws is op verzoek
van de eigenaar gepauzeerd. De browserwaarschuwing over XSLT staat los van de
serverkoppeling.
