<?php
declare(strict_types=1);

// Public feeds only. No request parameter can select a destination or a local file.
const DT_TRAFFIC_URL = 'https://opendata.ndw.nu/actueel_beeld.xml.gz';
const DT_NEWS_URL = 'https://www.nu.nl/rss/Auto';
const DT_TRAFFIC_MAX_AGE = 300;
const DT_NEWS_MAX_AGE = 259200; // Only headlines published in the last 72 hours.

function dt_date(?string $value): ?int {
    if (!$value) return null;
    $iso = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/';
    $rss = '/^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+)?\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}(?::\d{2})?\s+(?:[+-]\d{4}|[A-Z]{2,4})$/';
    if (!preg_match($iso, $value) && !preg_match($rss, $value)) return null;
    try {
        $date = new DateTimeImmutable($value); $errors = DateTimeImmutable::getLastErrors();
        return $errors && ($errors['warning_count'] || $errors['error_count']) ? null : $date->getTimestamp();
    } catch (Throwable $error) { return null; }
}
function dt_iso(int $time): string { return gmdate('Y-m-d\TH:i:s\Z', $time); }
function dt_text(DOMXPath $xpath, string $name, ?DOMNode $context = null): string {
    $nodes = $xpath->query('.//*[local-name()="'.$name.'"]', $context);
    return $nodes && $nodes->length ? trim($nodes->item(0)->textContent) : '';
}
function dt_xml(string $xml): DOMDocument {
    if (strlen($xml) > 33554432 || preg_match('/<!\s*(DOCTYPE|ENTITY)/i', $xml)) {
        throw new RuntimeException('Unsupported XML document');
    }
    $previous = libxml_use_internal_errors(true);
    try {
        $doc = new DOMDocument();
        if (!$doc->loadXML($xml, LIBXML_NONET | LIBXML_NOBLANKS)) throw new RuntimeException('Invalid XML');
        return $doc;
    } finally { libxml_clear_errors(); libxml_use_internal_errors($previous); }
}
function dt_coordinates(float $a, float $b): ?array {
    // GML EPSG:4326 uses latitude/longitude; CRS84 uses longitude/latitude.
    if ($a >= 50.6 && $a <= 53.8 && $b >= 3.1 && $b <= 7.4) return [$b, $a];
    if ($b >= 50.6 && $b <= 53.8 && $a >= 3.1 && $a <= 7.4) return [$a, $b];
    return null;
}
function dt_geometry(DOMXPath $xpath): array {
    $lines = $xpath->query('//*[local-name()="posList"]');
    $result = [];
    foreach ($lines as $line) {
        $dimension = $line->getAttribute('srsDimension');
        if ($dimension !== '' && $dimension !== '2') continue;
        $values = preg_split('/\s+/', trim($line->textContent));
        if (count($values) % 2 !== 0 || count($values) > 4000) continue;
        $points = [];
        for ($i = 0; $i < count($values); $i += 2) {
            if (!is_numeric($values[$i]) || !is_numeric($values[$i+1])) { $points = []; break; }
            $point = dt_coordinates((float)$values[$i], (float)$values[$i+1]);
            if (!$point) { $points = []; break; }
            $points[] = $point;
        }
        if (count($points) >= 2) $result[] = $points;
    }
    if ($result) return ['type' => 'MultiLineString', 'coordinates' => $result];
    // A point report never turns an entire motorway red.
    foreach ($xpath->query('//*[local-name()="pointCoordinates"]') as $point) {
        $lat = dt_text($xpath, 'latitude', $point); $lon = dt_text($xpath, 'longitude', $point);
        if (is_numeric($lat) && is_numeric($lon)) {
            $coords = dt_coordinates((float)$lat, (float)$lon);
            if ($coords) return ['type' => 'Point', 'coordinates' => $coords];
        }
    }
    return [];
}
function dt_parse_traffic(string $xml, int $now): array {
    // XMLReader bounds memory usage for national situation feeds.
    if (strlen($xml) > 33554432 || preg_match('/<!\s*(DOCTYPE|ENTITY)/i', $xml)) throw new RuntimeException('Unsupported traffic XML');
    $previous = libxml_use_internal_errors(true);
    $reader = new XMLReader();
    $jams = []; $seen = []; $publication = null; $recordCount = 0; $unmapped = 0; $situationPublication = false;
    try {
        if (!@$reader->XML($xml, null, LIBXML_NONET | LIBXML_NOBLANKS)) throw new RuntimeException('Invalid traffic XML');
        $reader->setParserProperty(XMLReader::LOADDTD, false);
        $reader->setParserProperty(XMLReader::SUBST_ENTITIES, false);
        while (@$reader->read()) {
            if ($reader->nodeType !== XMLReader::ELEMENT) continue;
            if (preg_match('/(^|:)SituationPublication$/', $reader->getAttributeNs('type', 'http://www.w3.org/2001/XMLSchema-instance') ?? '')) $situationPublication = true;
            if ($reader->localName === 'publicationTime' && $publication === null) $publication = dt_date($reader->readString());
            if ($reader->localName !== 'situationRecord') continue;
            if (++$recordCount > 15000) throw new RuntimeException('Too many records');
            $type = $reader->getAttributeNs('type', 'http://www.w3.org/2001/XMLSchema-instance') ?? '';
            $node = @$reader->expand();
            if (!$node) throw new RuntimeException('Invalid situation record');
            $doc = new DOMDocument(); $doc->appendChild($doc->importNode($node, true)); $xpath = new DOMXPath($doc);
            $trafficType = dt_text($xpath, 'abnormalTrafficType');
            if (!preg_match('/(^|:)AbnormalTraffic$/', $type) && $trafficType === '') continue;
            if (!in_array($trafficType, ['stationaryTraffic','queuingTraffic','slowTraffic','trafficCongestion'], true)) continue;
            $status = dt_text($xpath, 'validityStatus');
            if ($status !== '' && !in_array($status, ['active','definedByValidityTimeSpec'], true)) continue;
            $start = dt_date(dt_text($xpath, 'overallStartTime')); $end = dt_date(dt_text($xpath, 'overallEndTime'));
            if (($start !== null && $start > $now) || ($end !== null && $end <= $now)) continue;
            $id = $doc->documentElement->getAttribute('id');
            $geometry = dt_geometry($xpath);
            if (!$geometry) { $unmapped++; continue; }
            $fingerprint = hash('sha256', json_encode($geometry).$trafficType);
            if (isset($seen[$fingerprint])) continue;
            $seen[$fingerprint] = true;
            $road = dt_text($xpath, 'roadNumber');
            if (!preg_match('/^[AN]\s?\d{1,3}$/', $road)) {
                $comment = implode(' ', array_map(fn($n) => $n->textContent, iterator_to_array($xpath->query('//*[local-name()="value"]'))));
                $road = preg_match('/\b([AN]\d{1,3})\b/', $comment, $match) ? $match[1] : '';
            }
            $jams[] = ['id' => substr($id ?: $fingerprint, 0, 160), 'road' => str_replace(' ', '', $road),
                'type' => $trafficType, 'geometry' => $geometry];
            if (count($jams) > 2000) throw new RuntimeException('Too many mapped jams');
        }
        if (libxml_get_errors()) throw new RuntimeException('Malformed traffic XML');
    } finally { $reader->close(); libxml_clear_errors(); libxml_use_internal_errors($previous); }
    if (!$situationPublication || $publication === null || $publication > $now + 120 || $now - $publication > DT_TRAFFIC_MAX_AGE) {
        throw new RuntimeException('Traffic publication timestamp missing or stale');
    }
    return ['status'=>'ok', 'source'=>'NDW', 'sourceUrl'=>'https://opendata.ndw.nu/',
        'sourceUpdatedAt'=>dt_iso($publication), 'checkedAt'=>dt_iso($now),
        'expiresAt'=>dt_iso($publication + DT_TRAFFIC_MAX_AGE), 'jams'=>$jams, 'unmappedReports'=>$unmapped];
}
function dt_news_url(string $url): bool {
    $parts = parse_url($url);
    return $parts && ($parts['scheme'] ?? '') === 'https' && in_array(strtolower($parts['host'] ?? ''), ['www.nu.nl','nu.nl'], true)
        && !isset($parts['user']) && !isset($parts['pass']) && !isset($parts['port']);
}
function dt_parse_news(string $xml, int $now): array {
    $doc = dt_xml($xml); $xpath = new DOMXPath($doc); $articles = []; $seen = [];
    $items = $xpath->query('//*[local-name()="channel"]/*[local-name()="item"]');
    if (!$items || !$xpath->query('//*[local-name()="channel"]')->length) throw new RuntimeException('Not an RSS feed');
    foreach ($items as $item) {
        $title = trim(strip_tags(dt_text($xpath, 'title', $item)));
        $url = dt_text($xpath, 'link', $item); $published = dt_date(dt_text($xpath, 'pubDate', $item));
        if (!$title || strlen($title) > 1000 || !dt_news_url($url) || $published === null || $published > $now + 120 || $now-$published > DT_NEWS_MAX_AGE || isset($seen[$url])) continue;
        $seen[$url] = true; $articles[] = ['title'=>$title,'url'=>$url,'publishedAt'=>dt_iso($published),'source'=>'NU.nl Auto'];
    }
    usort($articles, fn($a,$b) => strcmp($b['publishedAt'], $a['publishedAt']));
    return ['status'=>'ok','source'=>'NU.nl Auto','sourceUrl'=>'https://www.nu.nl/auto','checkedAt'=>dt_iso($now),
        'expiresAt'=>dt_iso($now + 1200), 'articles'=>array_slice($articles,0,6)];
}
function dt_fetch(string $url): string {
    if (!function_exists('curl_init')) throw new RuntimeException('PHP cURL required');
    $body = ''; $curl = curl_init($url);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER=>false, CURLOPT_CONNECTTIMEOUT=>4, CURLOPT_TIMEOUT=>12,
        CURLOPT_FOLLOWLOCATION=>false, CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS, CURLOPT_SSL_VERIFYPEER=>true,
        CURLOPT_SSL_VERIFYHOST=>2, CURLOPT_ENCODING=>'', CURLOPT_USERAGENT=>'DeTakelaar.nl public-feed reader/1.0',
        CURLOPT_WRITEFUNCTION=>function($handle, string $chunk) use (&$body): int {
            if (strlen($body)+strlen($chunk) > 8388608) return 0;
            $body .= $chunk; return strlen($chunk);
        }]);
    try {
        if (curl_exec($curl) === false || curl_getinfo($curl, CURLINFO_HTTP_CODE) !== 200) throw new RuntimeException('Feed request failed');
    } finally { curl_close($curl); }
    if (substr($body,0,2) === "\x1f\x8b") {
        $body = @gzdecode($body, 33554433);
        if ($body === false) throw new RuntimeException('Invalid compressed feed');
    }
    if (!$body || strlen($body)>33554432) throw new RuntimeException('Invalid feed size');
    return $body;
}
function dt_cached(string $kind, int $now, callable $load): array {
    $ttl = $kind === 'traffic' ? 60 : 600;
    $directory = sys_get_temp_dir().'/detakelaar-live-'.substr(hash('sha256', __DIR__),0,16);
    if (!is_dir($directory) && !@mkdir($directory,0700,true) && !is_dir($directory)) throw new RuntimeException('Cache unavailable');
    if (is_link($directory)) throw new RuntimeException('Invalid cache directory');
    $file = $directory.'/'.$kind.'.json'; $lock = fopen($directory.'/'.$kind.'.lock','c');
    if (!$lock) throw new RuntimeException('Cache lock unavailable');
    try {
        // Do not queue visitors behind a slow upstream request.
        if (!flock($lock, LOCK_EX | LOCK_NB)) {
            $cached = is_file($file) ? json_decode((string)file_get_contents($file),true) : null;
            if ($cached && ($cached['refreshAfter'] ?? 0)>$now && (dt_date($cached['data']['expiresAt'] ?? '') ?? 0)>$now) return $cached['data'];
            throw new RuntimeException('Refresh in progress');
        }
        $cached = is_file($file) ? json_decode((string)file_get_contents($file),true) : null;
        if ($cached && ($cached['refreshAfter'] ?? 0)>$now && (dt_date($cached['data']['expiresAt'] ?? '') ?? 0)>$now) return $cached['data'];
        if ($cached && ($cached['retryAfter'] ?? 0)>$now) throw new RuntimeException('Feed temporarily unavailable');
        try {
            $data = $load(); $result = ['refreshAfter'=>$now+$ttl,'data'=>$data];
        } catch (Throwable $error) {
            // Brief negative cache limits upstream load; old red segments are never returned.
            $result = ['retryAfter'=>$now+30]; $data = null;
        }
        $temp = tempnam($directory, 'feed-');
        if (!$temp || file_put_contents($temp,json_encode($result,JSON_THROW_ON_ERROR)) === false || !rename($temp,$file)) {
            if ($temp && is_file($temp)) unlink($temp);
            throw new RuntimeException('Could not write cache');
        }
        if ($data === null) throw new RuntimeException('Feed temporarily unavailable');
        return $data;
    } finally { flock($lock,LOCK_UN); fclose($lock); }
}
function dt_respond(string $kind): void {
    header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    try {
        $now = time();
        $data = dt_cached($kind, $now, fn() => $kind === 'traffic'
            ? dt_parse_traffic(dt_fetch(DT_TRAFFIC_URL),$now) : dt_parse_news(dt_fetch(DT_NEWS_URL),$now));
        echo json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (Throwable $error) {
        http_response_code(503);
        echo json_encode(['status'=>'unavailable','message'=>$kind==='traffic' ? 'Verkeersinformatie tijdelijk niet beschikbaar.' : 'Nieuws tijdelijk niet beschikbaar.']);
    }
}
