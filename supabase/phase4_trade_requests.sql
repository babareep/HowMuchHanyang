-- =====================================================================
-- Phase 4. 판매 거래 (구매 요청 → 승인/거절 → 판매 완료)
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 한 번 실행하세요.
-- 여러 번 실행해도 안전하도록 작성했습니다.
--
-- 전제: items.id 가 uuid 입니다. (bigint 라면 아래 item_id 타입을 bigint 로,
--       함수 인자 p_item_id 도 bigint 로 바꿔 주세요.)
-- =====================================================================

-- 1) 거래 요청 테이블 ---------------------------------------------------
create table if not exists public.trade_requests (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.items(id) on delete cascade,
  seller_id       uuid not null,
  requester_id    uuid not null,
  requester_email text,
  trade_type      text not null default 'SALE' check (trade_type in ('SALE', 'RENTAL')),
  status          text not null default 'PENDING'
                  check (status in ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (seller_id <> requester_id)
);

create index if not exists trade_requests_seller_idx    on public.trade_requests (seller_id, created_at desc);
create index if not exists trade_requests_requester_idx on public.trade_requests (requester_id, created_at desc);

-- 같은 사용자가 같은 상품에 "진행 중(PENDING/APPROVED)" 요청을 두 개 가질 수 없음
create unique index if not exists trade_requests_one_active_per_user
  on public.trade_requests (item_id, requester_id)
  where status in ('PENDING', 'APPROVED');

-- 한 판매 상품에는 승인/완료된 요청이 최대 1개 (동시 승인 최후 방어선)
create unique index if not exists trade_requests_one_approved_per_sale_item
  on public.trade_requests (item_id)
  where trade_type = 'SALE' and status in ('APPROVED', 'COMPLETED');

-- 2) RLS: 조회는 당사자만, 쓰기는 아래 함수로만 ------------------------------
alter table public.trade_requests enable row level security;

drop policy if exists "trade_requests_select_own" on public.trade_requests;
create policy "trade_requests_select_own" on public.trade_requests
  for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = seller_id);
-- INSERT/UPDATE/DELETE 정책은 만들지 않습니다 → 클라이언트가 직접 수정 불가.

-- 3) 구매 요청 보내기 --------------------------------------------------
create or replace function public.create_purchase_request(p_item_id uuid)
returns public.trade_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_item public.items%rowtype;
  v_req  public.trade_requests%rowtype;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_item from public.items where id = p_item_id for update;
  if not found then
    raise exception '상품을 찾을 수 없습니다.';
  end if;
  if v_item.trade_type <> 'SALE' then
    raise exception '판매 상품에만 구매 요청을 보낼 수 있습니다.';
  end if;
  if v_item.seller_id::text = v_uid::text then
    raise exception '내 상품에는 구매 요청을 보낼 수 없습니다.';
  end if;
  if v_item.status <> 'AVAILABLE' then
    raise exception '이미 예약되었거나 판매가 완료된 상품입니다.';
  end if;

  begin
    insert into public.trade_requests (item_id, seller_id, requester_id, requester_email, trade_type, status)
    values (v_item.id, v_item.seller_id::uuid, v_uid, auth.jwt() ->> 'email', 'SALE', 'PENDING')
    returning * into v_req;
  exception when unique_violation then
    raise exception '이미 이 상품에 진행 중인 구매 요청이 있습니다.';
  end;

  return v_req;
end;
$$;

-- 4) 승인 / 거절 (판매자만) ----------------------------------------------
create or replace function public.respond_purchase_request(p_request_id uuid, p_action text)
returns public.trade_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_req  public.trade_requests%rowtype;
  v_item public.items%rowtype;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_action not in ('APPROVE', 'REJECT') then
    raise exception '잘못된 요청입니다.';
  end if;

  select * into v_req from public.trade_requests where id = p_request_id;
  if not found then
    raise exception '요청을 찾을 수 없습니다.';
  end if;

  -- 상품 행을 먼저 잠가서, 같은 상품에 대한 동시 승인이 차례대로 처리되게 함
  select * into v_item from public.items where id = v_req.item_id for update;
  select * into v_req from public.trade_requests where id = p_request_id for update;

  if v_item.seller_id::text <> v_uid::text or v_req.seller_id <> v_uid then
    raise exception '판매자만 요청을 처리할 수 있습니다.';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception '이미 처리된 요청입니다.';
  end if;

  if p_action = 'REJECT' then
    update public.trade_requests
       set status = 'REJECTED', updated_at = now()
     where id = p_request_id
    returning * into v_req;
    return v_req;
  end if;

  -- APPROVE
  if v_item.status <> 'AVAILABLE' then
    raise exception '이미 승인되었거나 판매가 완료된 상품입니다.';
  end if;

  update public.items set status = 'RESERVED' where id = v_item.id;
  update public.trade_requests
     set status = 'APPROVED', updated_at = now()
   where id = p_request_id
  returning * into v_req;
  return v_req;
exception when unique_violation then
  raise exception '이미 승인되었거나 판매가 완료된 상품입니다.';
end;
$$;

-- 5) 판매 완료 (판매자만, 승인된 요청에 대해서만) ---------------------------
create or replace function public.complete_purchase_request(p_request_id uuid)
returns public.trade_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_req  public.trade_requests%rowtype;
  v_item public.items%rowtype;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_req from public.trade_requests where id = p_request_id;
  if not found then
    raise exception '요청을 찾을 수 없습니다.';
  end if;

  select * into v_item from public.items where id = v_req.item_id for update;
  select * into v_req from public.trade_requests where id = p_request_id for update;

  if v_item.seller_id::text <> v_uid::text or v_req.seller_id <> v_uid then
    raise exception '판매자만 판매 완료 처리할 수 있습니다.';
  end if;
  if v_req.status <> 'APPROVED' or v_item.status <> 'RESERVED' then
    raise exception '승인된 요청만 판매 완료 처리할 수 있습니다.';
  end if;

  update public.items set status = 'COMPLETED' where id = v_item.id;
  update public.trade_requests
     set status = 'COMPLETED', updated_at = now()
   where id = p_request_id
  returning * into v_req;

  -- 같은 상품에 남아 있던 대기 요청은 자동 거절
  update public.trade_requests
     set status = 'REJECTED', updated_at = now()
   where item_id = v_item.id and status = 'PENDING';

  return v_req;
end;
$$;

-- 6) 실행 권한: 로그인 사용자만 --------------------------------------------
revoke all on function public.create_purchase_request(uuid)          from public, anon;
revoke all on function public.respond_purchase_request(uuid, text)   from public, anon;
revoke all on function public.complete_purchase_request(uuid)        from public, anon;
grant execute on function public.create_purchase_request(uuid)        to authenticated;
grant execute on function public.respond_purchase_request(uuid, text) to authenticated;
grant execute on function public.complete_purchase_request(uuid)      to authenticated;

-- 7) (권장) items 상태를 클라이언트가 직접 바꾸지 못하게 하기
--    items 에 "본인 UPDATE" 정책이 있다면 판매자가 status 를 임의로 바꿀 수 있습니다.
--    Phase 4 에서는 상태 변경을 위 함수로만 하므로, 아래 쿼리로 정책 유무를 확인하세요.
--    select policyname, cmd from pg_policies where tablename = 'items';
