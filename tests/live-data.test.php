<?php
declare(strict_types=1);
require __DIR__.'/../api/live-lib.php';
$now = strtotime('2026-11-04T10:00:00Z');
$count = 0;
function check(bool $condition, string $message): void { global $count; if (!$condition) throw new RuntimeException($message); $count++; }
function rejects(callable $call, string $message): void { $failed=false; try { $call(); } catch (RuntimeException $e) { $failed=true; } check($failed,$message); }
function record(string $id, string $contents, string $type='sit:AbnormalTraffic'): string {
    return '<situationRecord id="'.$id.'" xsi:type="'.$type.'"><abnormalTrafficType>queuingTraffic</abnormalTrafficType>'.$contents.'</situationRecord>';
}
function traffic(string $records, string $time='2026-11-04T09:59:40Z'): string {
    return '<d2LogicalModel xmlns="http://datex2.eu/schema/2/2_0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:sit="http://datex2.eu/schema/2/2_0" xmlns:gml="http://www.opengis.net/gml"><payloadPublication xsi:type="sit:SituationPublication"><publicationTime>'.$time.'</publicationTime><situation>'.$records.'</situation></payloadPublication></d2LogicalModel>';
}
$valid='<validity><validityStatus>active</validityStatus><validityTimeSpecification><overallStartTime>2026-11-04T09:30:00Z</overallStartTime><overallEndTime>2026-11-04T11:30:00Z</overallEndTime></validityTimeSpecification></validity>';
$line='<location><roadNumber>A12</roadNumber><gml:LineString><gml:posList>52.04 4.60 52.05 4.65 52.06 4.70</gml:posList></gml:LineString></location>';
$point='<location><pointCoordinates><latitude>52.05</latitude><longitude>4.4</longitude></pointCoordinates><roadNumber>A4</roadNumber></location>';
$xml=traffic(record('jam',$valid.$line).record('same-jam',$valid.$line).record('point',$valid.$point)
    .record('ended',str_replace('11:30:00','09:30:00',$valid).$point)
    .record('future',str_replace('09:30:00','10:30:00',$valid).$point)
    .record('suspended',str_replace('active','suspended',$valid).$point)
    .record('no-position',$valid)
    .record('works',$valid.$line,'sit:Roadworks'));
$data=dt_parse_traffic($xml,$now);
check(count($data['jams'])===2,'Only active deduplicated jams may appear');
check($data['jams'][0]['geometry']['coordinates'][0][0]===[4.6,52.04],'Latitude/longitude must convert correctly');
check($data['jams'][1]['geometry']['type']==='Point','Point report must not invent a road segment');
check($data['unmappedReports']===1,'Unmapped reports remain distinguishable');
check($data['expiresAt']==='2026-11-04T10:04:40Z','Expiry uses provider publication, not request time');
check(count(dt_parse_traffic(traffic(''),$now)['jams'])===0,'A current empty situation publication is valid');
check(dt_parse_traffic(traffic(record('crs84',$valid.str_replace('52.04 4.60 52.05 4.65 52.06 4.70','4.60 52.04 4.65 52.05 4.70 52.06',$line))),$now)['jams'][0]['geometry']['coordinates'][0][0]===[4.6,52.04],'CRS84 order is supported');
rejects(fn()=>dt_parse_traffic(traffic('','2026-11-04T09:40:00Z'),$now),'Old publication must fail closed');
rejects(fn()=>dt_parse_traffic(traffic('','2026-11-04T10:10:00Z'),$now),'Future publication must fail closed');
rejects(fn()=>dt_parse_traffic('<rss><publicationTime>2026-11-04T10:00:00Z</publicationTime></rss>',$now),'Unrelated XML must not mean no files');
rejects(fn()=>dt_parse_traffic(substr($xml,0,-30),$now),'Truncated XML must fail');
rejects(fn()=>dt_parse_traffic('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]>'.$xml,$now),'DTD/external entities must be rejected');
function item(string $title, string $url, string $date): string { return '<item><title>'.htmlspecialchars($title,ENT_XML1).'</title><link>'.htmlspecialchars($url,ENT_XML1).'</link><pubDate>'.$date.'</pubDate></item>'; }
$rss='<rss><channel>'.item('Recent autonieuws','https://www.nu.nl/auto/123/test.html','Wed, 04 Nov 2026 09:00:00 +0000')
    .item('Duplicate','https://www.nu.nl/auto/123/test.html','Wed, 04 Nov 2026 09:00:00 +0000')
    .item('Oud nieuws','https://www.nu.nl/auto/old','Sat, 31 Oct 2026 09:00:00 +0000')
    .item('Future','https://www.nu.nl/auto/future','Wed, 04 Nov 2026 12:00:00 +0000')
    .item('Unsafe','javascript:alert(1)','Wed, 04 Nov 2026 09:00:00 +0000')
    .item('Other site','https://attacker.example/item','Wed, 04 Nov 2026 09:00:00 +0000').'</channel></rss>';
$news=dt_parse_news($rss,$now);
check(count($news['articles'])===1,'Only recent, safe, unique source links allowed');
check($news['articles'][0]['title']==='Recent autonieuws','Headline is preserved');
rejects(fn()=>dt_parse_news('<html/>',$now),'Not-RSS must not be accepted');
check(dt_date('now')===null,'Relative date text cannot act as a publication timestamp');
check(dt_coordinates(4.7,52.04)===[4.7,52.04],'Coordinate axes handled');
check(dt_coordinates(90,90)===null,'Out-of-country coordinates rejected');
$cacheKind='test-'.bin2hex(random_bytes(6)); $calls=0;
$loader=function() use (&$calls,$now) { $calls++; return ['expiresAt'=>dt_iso($now+100),'status'=>'ok']; };
dt_cached($cacheKind,$now,$loader);dt_cached($cacheKind,$now+1,$loader);
check($calls===1,'Fresh cache must avoid duplicate upstream requests');
rejects(fn()=>dt_cached($cacheKind,$now+700,fn()=>throw new RuntimeException('offline')),'Expired cache must not be returned on failure');
$dir=sys_get_temp_dir().'/detakelaar-live-'.substr(hash('sha256',realpath(__DIR__.'/../api')),0,16);
@unlink($dir.'/'.$cacheKind.'.json');@unlink($dir.'/'.$cacheKind.'.lock');
check(dt_failure_reason(new DtFeedFailure('SOURCE_HTTP_403'))==='SOURCE_HTTP_403','HTTP reason remains diagnosable');
check(dt_failure_reason(new RuntimeException('private server information'))==='SOURCE_DATA_INVALID','Internal details must not leak');
echo "PASS $count backend checks: geography, timestamps, active validity, XML safety, RSS recency and cache failure.\n";
