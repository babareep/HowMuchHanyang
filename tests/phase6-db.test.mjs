import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
// Isolated PostgreSQL; never connects to the live Supabase project.
const { PGlite } = await import(process.env.PHASE6_PGLITE_MODULE ?? '@electric-sql/pglite');
const migration = await readFile(new URL('../supabase/migrations/202611070001_phase6_trades.sql', import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';
const C = '00000000-0000-0000-0000-000000000003';

for (const enums of [false, true]) test(`Phase 6 PostgreSQL integration (${enums ? 'enum' : 'text'} status)`, async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; grant usage on schema auth to public;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      ${enums ? "create type item_status as enum ('AVAILABLE','RESERVED','COMPLETED'); create type request_status as enum ('PENDING','APPROVED','REJECTED','COMPLETED');" : ''}
      create table items(id uuid primary key default gen_random_uuid(), seller_id uuid, title text, description text, location text,
        price numeric, trade_type text, status ${enums ? 'item_status' : 'text'}, rental_start_date date, rental_end_date date);
      create table trade_requests(id uuid primary key default gen_random_uuid(), item_id uuid references items, buyer_id uuid,
        status ${enums ? 'request_status' : 'text'}, rental_start_date date, rental_end_date date, created_at timestamptz default now());`);
    await db.exec(`grant all on items, trade_requests to anon, authenticated;
      create policy legacy_items_open on items for all to public using (true) with check (true);
      create policy legacy_requests_open on trade_requests for all to public using (true) with check (true);`);
    await db.exec(migration);
    // Migration must also be safely rerunnable.
    await db.exec(migration);
    async function as(user) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]); await db.exec('set role authenticated'); }
    async function product(type = 'SALE') {
      await db.exec('reset role');
      const { rows } = await db.query("insert into items(seller_id,title,description,location,price,trade_type,status,rental_start_date,rental_end_date) values ($1,'교재','설명','한양대',1000,$2,'AVAILABLE',current_date,current_date + 100) returning id", [A, type]);
      return rows[0].id;
    }
    const { rows: [dates] } = await db.query("select ((now() at time zone 'Asia/Seoul')::date + 3)::text as a, ((now() at time zone 'Asia/Seoul')::date + 5)::text as b, ((now() at time zone 'Asia/Seoul')::date + 6)::text as c, ((now() at time zone 'Asia/Seoul')::date + 8)::text as d");
    async function request(item, start = null, end = null) { return (await db.query('select phase6_request_trade($1,$2::date,$3::date) as r', [item, start, end])).rows[0].r; }
    async function action(id, type) { return db.query('select phase6_update_trade($1,$2)', [id, type]); }
    async function state(table, id) { await db.exec('reset role'); return (await db.query(`select status from ${table} where id=$1`, [id])).rows[0].status; }

    const sale = await product();
    await as(A); await assert.rejects(request(sale), /본인 상품/);
    await as(B); const first = await request(sale); await assert.rejects(request(sale), /이미 진행/);
    await as(C); const second = await request(sale);
    await assert.rejects(db.query("insert into trade_requests(item_id,buyer_id,status) values ($1,$2,'APPROVED')", [sale, C]), /row-level security/);
    assert.equal((await db.query("update items set status='COMPLETED' where id=$1 returning id", [sale])).rows.length, 0);
    assert.equal((await db.query('select * from trade_requests')).rows.length, 1, 'C sees only their own request');
    await assert.rejects(action(first.id, 'APPROVE'), /권한/);
    assert.equal((await db.query("update trade_requests set status='APPROVED' where id=$1 returning id", [second.id])).rows.length, 0, 'Direct API updates are blocked');
    await as(A); assert.equal((await db.query('select * from trade_requests')).rows.length, 2, 'Seller sees received requests');
    await action(first.id, 'APPROVE');
    assert.equal(await state('items', sale), 'RESERVED');
    assert.equal(await state('trade_requests', second.id), 'REJECTED');
    await as(A); await assert.rejects(action(second.id, 'APPROVE'), /이미 처리/);
    await assert.rejects(action(first.id, 'INVALID'), /지원하지 않는/);
    await action(first.id, 'COMPLETE');
    assert.equal(await state('items', sale), 'COMPLETED');
    assert.equal(await state('trade_requests', first.id), 'COMPLETED');
    await as(A); await assert.rejects(action(first.id, 'COMPLETE'), /승인된 요청/);
    await as(B); await assert.rejects(request(sale), /상품 상태/);

    const rental = await product('RENTAL');
    await as(B); const rent1 = await request(rental, dates.a, dates.b);
    await as(C); const overlap = await request(rental, dates.b, dates.c);
    await as(A); await action(rent1.id, 'APPROVE');
    assert.equal((await db.query('select * from phase6_rental_availability($1)', [rental])).rows.length, 1);
    await assert.rejects(action(overlap.id, 'APPROVE'), /날짜가 겹칩니다/);
    assert.equal(await state('trade_requests', overlap.id), 'PENDING', 'Failed approval rolls back');
    await as(A); await action(overlap.id, 'REJECT');
    await as(C); await assert.rejects(request(rental, dates.d, dates.a), /올바른 날짜/);
    await assert.rejects(request(rental, '2000-01-01', '2000-01-02'), /올바른 날짜/);
    await assert.rejects(request(rental, dates.b, dates.c), /날짜가 겹칩니다/);
    const rent2 = await request(rental, dates.c, dates.d);
    await as(A); await action(rent2.id, 'APPROVE');
    await action(rent1.id, 'COMPLETE');
    assert.equal(await state('items', rental), 'RESERVED', 'Another approved rental stays reserved');
    await as(A); await action(rent2.id, 'COMPLETE');
    assert.equal(await state('items', rental), 'AVAILABLE');
    await as(C); const repeat = await request(rental, dates.c, dates.d); assert.equal(repeat.status, 'PENDING', 'Completed/rejected history does not block a new request');
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); set role anon");
    assert.equal((await db.query('select * from trade_requests')).rows.length, 0);
    await assert.rejects(db.query('select phase6_request_trade($1,null,null)', [rental]), /permission denied/);
    await assert.rejects(db.query('select phase6_update_trade($1, $2)', [repeat.id, 'APPROVE']), /permission denied/);
  } finally { await db.close(); }
});
