# Zoekvindbaarheid: publiceren en opvolgen

## Wat is voorbereid

- Beschrijvende paginatitels, unieke inhoud en absolute canonical-URL's.
- Direct leesbare Nederlandse HTML, inclusief telefoonlinks zonder JavaScript.
- Drie onderling verbonden dienstpagina's: autotransport, pech- en schadevervoer, zorgvuldig autovervoer.
- Zichtbare vragen en antwoorden met overeenkomstige FAQPage-gegevens; Organization, WebSite, WebPage en Service-gegevens; broodkruimels op dienstpagina's.
- sitemap.xml en robots.txt. Geen verzonnen vestigingen, reviews, prijzen of openingstijden. De eigenaar heeft contactlocaties in Gouda (Kampenringweg 17a) en Rijswijk (Cobbenhagenstraat 24) opgegeven. Deze zijn zichtbaar en als Organization.location opgenomen; er zijn geen openingstijden of bezoekgaranties ingevuld.

Dit verbetert de begrijpelijkheid voor zoekmachines en AI-antwoorddiensten (SEO, GEO en AEO), maar garandeert geen rangschikking, indexering, AI-vermelding of rich result. Er bestaat geen speciale code die een toppositie oplevert. FAQ-rich-results worden door Google doorgaans beperkt tot gezaghebbende gezondheids- en overheidssites; verwacht die niet voor deze website. De relatie tussen DeTakelaar.nl en de KvK-inschrijving is nog niet vastgesteld; daarom is geen juridische bedrijfsnaam of KvK-nummer gepubliceerd.

## Update van de bestaande TransIP-site

Maak eerst een lokale kopie van de huidige bestanden die je vervangt. Upload daarna vanuit de GitHub-ZIP de volgende bestanden direct naar /www:

- maps.js (nieuw; kaartlinks voor iPhone/iPad, Android en desktop)
- index.html en styles.css (vervangen; controleer dat er geen index(1).html ontstaat)
- privacy.html (vervangen)
- autotransport.html, pechhulp-schadevervoer.html, zorgvuldig-autovervoer.html (nieuw)
- robots.txt en sitemap.xml (nieuw; als ze al bestaan, eerst downloaden en vergelijken)

app.js, vehicle.js, config.js en assets blijven nodig en zijn al aanwezig. README, tests en dit document hoeven niet naar de openbare webmap. De bestaande .htaccess met `DirectoryIndex index.html index.php` behouden. Geen volledige vervangende .htaccess uploaden.

Controleer na upload het hoofdadres, de drie dienstpagina's, /robots.txt en /sitemap.xml. Iedere dienstpagina hoort eigen inhoud te tonen, geen WordPress-404. Controleer de canonical met paginabron weergeven. Controleer de kentekencheck en het aanvraagformulier opnieuw. Alleen de lokaal gebouwde versie is gecontroleerd; handmatig uploaden naar TransIP gebeurt buiten deze werkmap.

Verwijder na lokaal veiligstellen oude openbare kopieën zoals index-oud.html en de testmap /nieuw als je ze niet meer nodig hebt. robots.txt blokkeert crawlen van deze paden, maar is geen beveiliging of betrouwbare verwijdering uit een zoekindex. Een niet-publieke back-up verdient de voorkeur. /index.html mag bereikbaar blijven en verwijst via canonical naar /. Controleer dat http en www uiteindelijk via een 301 naar de bedoelde HTTPS-variant gaan; pas dit aan via TransIP-instellingen wanneer nodig. Een canonical is een aanwijzing, geen redirect.

## Google en Bing (account van de eigenaar nodig)

1. Voeg detakelaar.nl als domeineigenschap toe aan Google Search Console. Neem de exacte DNS-TXT-verificatiecode over die Google voor jouw account geeft; verzin geen code en wijzig geen mailrecords.
2. Dien https://detakelaar.nl/sitemap.xml in. Inspecteer na upload het hoofdadres en de drie dienstpagina's en vraag zo nodig indexering aan. Indexering kan tijd kosten en wordt niet gegarandeerd.
3. Voeg de site ook toe aan Bing Webmaster Tools, eventueel door de geverifieerde Search Console-site te importeren. Dien daar dezelfde sitemap in.
4. Controleer de openbare pagina's met Google Rich Results Test en Schema.org Validator. De lokale controle valideert JSON en verwijzingen, geen acceptatie door Google.
5. Maak of actualiseer één echt Google Bedrijfsprofiel. Gebruik het exacte bedrijfsnummer en de echte vestigingsplaats. Voor een bedrijf dat klanten op locatie bedient: gebruik een passend servicegebied en verberg een privé-adres wanneer dat volgens de profielregels hoort. Maak geen fictieve vestigingen.
6. Vraag klanten na een echte opdracht om een eerlijke review. Voeg echte bedrijfsfoto's toe wanneer beschikbaar. Geen gekochte reviews of automatisch gegenereerde plaatsnaam-pagina's.

## Nog benodigde bedrijfsinformatie

Bevestig de juridische relatie met de KvK-inschrijving, de werkende zakelijke mailbox en feitelijke beschikbaarheid. Voeg deze zichtbaar en consequent toe voordat overeenkomstige structured data wordt uitgebreid. Ga geen 24/7-, vergunning- of verzekeringsclaims toevoegen zonder onderbouwing.

## Meten

Beoordeel in Search Console na indexering vertoningen, klikken, zoekvragen en indexeringsproblemen. Vergelijk perioden en let op zoekintentie, niet alleen op één handmatig opgezochte positie. AI-vermeldingen zijn veranderlijk en niet gegarandeerd. Verbeter inhoud met echte vragen van klanten en concrete, controleerbare informatie. Er zijn geen trackingcookies toegevoegd door deze update.

## Postcodes en Google-reviews

Door eigenaar bevestigd: Kampenringweg 17a, 2803 PE Gouda; Cobbenhagenstraat 24, 2288 ET Rijswijk. De postcodes staan in zichtbare adressen, kaartlinks en PostalAddress-gegevens.

De homepage bevat een reviewsectie. De eigenaar bevestigt dat er nog geen Google Bedrijfsprofiel is. Maak eerst een profiel voor de werkelijke bedrijfsactiviteit en rond de verificatie af; neem daarna de reviewlink rechtstreeks uit dat profiel over. Tot die tijd wordt geen werkende Google-reviewknop gesuggereerd: er staat een korte melding dat dit binnenkort beschikbaar komt. Voeg daarna een geverifieerde review-URL als href toe aan #google-review-link, verwijder hidden en verwijder #google-review-pending. Geen verzonnen reviews, sterrenscores, beloningen of selectie op positieve ervaringen toevoegen.
