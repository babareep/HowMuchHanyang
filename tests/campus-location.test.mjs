import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCampusLocation, parseCampusLocation, locationLabel, mapPoint, nearestCampusBuilding, campusBuildings } from '../src/lib/campus-location.ts';

test('legacy locations remain plain text without an invented pin', () => {
  assert.deepEqual(parseCampusLocation('학생회관 정문 앞'), { label: '학생회관 정문 앞', point: null });
  assert.equal(locationLabel(null), '');
});
test('a saved location round-trips including edge coordinates', () => {
  for (const point of [{ x: 0, y: 100 }, { x: 42.36, y: 66.21 }]) {
    const saved = formatCampusLocation('  학생회관 정문 앞  ', point);
    assert.deepEqual(parseCampusLocation(saved), { label: '학생회관 정문 앞', point });
    assert.equal(locationLabel(saved), '학생회관 정문 앞');
    assert.equal(formatCampusLocation(saved, null), '학생회관 정문 앞');
  }
});
test('malformed/out-of-range coordinates cannot create an off-map pin', () => {
  assert.equal(parseCampusLocation('장소\n[HY-SEOUL-2608:101,30]').point, null);
  assert.equal(parseCampusLocation('장소\n[HY-SEOUL-2608:bad,30]').point, null);
  assert.equal(formatCampusLocation('장소', { x: NaN, y: 10 }), '장소');
});
test('pointer position accounts for scrolling and zoomed map size', () => {
  assert.deepEqual(mapPoint(300, 500, { left: 100, top: 100, width: 400, height: 800 }), { x: 50, y: 50 });
  assert.deepEqual(mapPoint(300, 500, { left: -100, top: -300, width: 800, height: 1600 }), { x: 50, y: 50 });
  assert.deepEqual(mapPoint(-10, 5000, { left: 0, top: 0, width: 100, height: 100 }), { x: 0, y: 100 });
  assert.equal(mapPoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }), null);
});

test('selecting a building center returns that building; invalid points are ignored', () => {
  for (const building of campusBuildings) assert.equal(nearestCampusBuilding(building)?.id, building.id);
  assert.equal(nearestCampusBuilding({ x: NaN, y: 0 }), null);
  const studentHall = campusBuildings.find(b => b.id === '107');
  assert.equal(nearestCampusBuilding({ x: studentHall.x + 0.2, y: studentHall.y + 0.2 }).id, '107');
});

test('corrected campus landmarks and nearby points resolve independently', () => {
  const fromPixels = (x, y) => ({ x: x / 1008 * 100, y: y / 1040 * 100 });
  for (const [x, y, name] of [
    [619, 678, '사자가 군것질할때 (사군)'],
    [700, 742, '제2공학관'], [688, 731, '제2공학관'],
    [687, 685, '학군단'],
    [628, 330, '한양여자대학교 식품영양관'], [630, 317, '한양여자대학교 식품영양관'],
    [626, 267, '한양여자대학교 유아교육관'],
    [304, 825, '정문'], [315, 832, '정문'],
    [949, 530, '후문'], [936, 526, '후문'],
  ]) assert.equal(nearestCampusBuilding(fromPixels(x, y)).name, name);
});
