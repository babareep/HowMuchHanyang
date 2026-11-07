-- Run once in Supabase SQL Editor as the DB owner, before testing Phase 6.
-- Existing columns: items(id, seller_id, trade_type, status, price, title,
-- description, location, rental_start_date, rental_end_date),
-- trade_requests(id, item_id, buyer_id, status, rental_start_date, rental_end_date).
-- Both tables must have default-generated IDs and accept the four request statuses.
begin;

create or replace function public.phase6_request_trade(p_item_id text, p_start_date date default null, p_end_date date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  product public.items%rowtype;
  result public.trade_requests%rowtype;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  select * into product from public.items where id::text = p_item_id for update;
  if not found then raise exception '상품을 찾을 수 없습니다.'; end if;
  if product.seller_id is null then raise exception '상품 등록자를 확인할 수 없습니다.'; end if;
  if product.seller_id = auth.uid() then raise exception '본인 상품에는 요청할 수 없습니다.'; end if;
  if not coalesce(product.status = 'AVAILABLE' or (product.trade_type = 'RENTAL' and product.status = 'RESERVED'), false) then
    raise exception '요청할 수 없는 상품 상태입니다.';
  end if;
  if exists (select 1 from public.trade_requests where item_id = product.id and buyer_id = auth.uid() and status in ('PENDING', 'APPROVED')) then
    raise exception '이미 진행 중인 요청이 있습니다.';
  end if;
  if product.trade_type = 'RENTAL' then
    if p_start_date is null or p_end_date is null or p_start_date < today or p_start_date > p_end_date
       or product.rental_start_date is null or product.rental_end_date is null
       or p_start_date < product.rental_start_date or p_end_date > product.rental_end_date then
      raise exception '대여 가능 기간 내의 올바른 날짜를 선택해 주세요.';
    end if;
    if exists (select 1 from public.trade_requests where item_id = product.id and status = 'APPROVED'
      and rental_start_date <= p_end_date and rental_end_date >= p_start_date) then
      raise exception '이미 승인된 예약과 날짜가 겹칩니다.';
    end if;
  elsif product.trade_type is distinct from 'SALE' then
    raise exception '지원하지 않는 거래 유형입니다.';
  end if;
  insert into public.trade_requests(item_id, buyer_id, status, rental_start_date, rental_end_date)
    values (product.id, auth.uid(), 'PENDING', case when product.trade_type = 'RENTAL' then p_start_date end,
      case when product.trade_type = 'RENTAL' then p_end_date end) returning * into result;
  return to_jsonb(result);
end;
$$;

create or replace function public.phase6_update_trade(p_request_id text, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  request public.trade_requests%rowtype;
  product public.items%rowtype;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  -- All mutations serialize on the item, including requests for different IDs.
  select i.* into product from public.items i join public.trade_requests r on r.item_id = i.id
    where r.id::text = p_request_id for update of i;
  if not found or product.seller_id is distinct from auth.uid() then raise exception '처리할 권한이 없습니다.'; end if;
  select * into request from public.trade_requests where id::text = p_request_id for update;
  if request.buyer_id = product.seller_id then raise exception '본인 상품 요청은 처리할 수 없습니다.'; end if;

  if p_action = 'REJECT' then
    if request.status is distinct from 'PENDING' then raise exception '대기 중인 요청만 거절할 수 있습니다.'; end if;
    update public.trade_requests set status = 'REJECTED' where id = request.id;
  elsif p_action = 'APPROVE' then
    if request.status is distinct from 'PENDING' then raise exception '이미 처리된 요청입니다.'; end if;
    if not coalesce(product.status = 'AVAILABLE' or (product.trade_type = 'RENTAL' and product.status = 'RESERVED'), false) then
      raise exception '승인할 수 없는 상품 상태입니다.';
    end if;
    if product.trade_type = 'SALE' then
      if exists (select 1 from public.trade_requests where item_id = product.id and status in ('APPROVED', 'COMPLETED')) then
        raise exception '이미 판매가 승인되거나 완료된 상품입니다.';
      end if;
      update public.trade_requests set status = 'REJECTED' where item_id = product.id and id <> request.id and status = 'PENDING';
    elsif product.trade_type = 'RENTAL' then
      if request.rental_start_date is null or request.rental_end_date is null
        or request.rental_start_date < (now() at time zone 'Asia/Seoul')::date
        or request.rental_start_date > request.rental_end_date
        or product.rental_start_date is null or product.rental_end_date is null
        or request.rental_start_date < product.rental_start_date or request.rental_end_date > product.rental_end_date then
        raise exception '올바른 대여 기간이 아닙니다.';
      end if;
      if exists (select 1 from public.trade_requests where item_id = product.id and id <> request.id and status = 'APPROVED'
        and rental_start_date <= request.rental_end_date and rental_end_date >= request.rental_start_date) then
        raise exception '이미 승인된 예약과 날짜가 겹칩니다.';
      end if;
    else raise exception '지원하지 않는 거래 유형입니다.';
    end if;
    update public.trade_requests set status = 'APPROVED' where id = request.id;
    update public.items set status = 'RESERVED' where id = product.id;
  elsif p_action = 'COMPLETE' then
    if request.status is distinct from 'APPROVED' then raise exception '승인된 요청만 완료할 수 있습니다.'; end if;
    update public.trade_requests set status = 'COMPLETED' where id = request.id;
    if product.trade_type = 'SALE' then
      update public.items set status = 'COMPLETED' where id = product.id;
    elsif exists (select 1 from public.trade_requests where item_id = product.id and status = 'APPROVED') then
      update public.items set status = 'RESERVED' where id = product.id;
    else
      update public.items set status = 'AVAILABLE' where id = product.id;
    end if;
  else raise exception '지원하지 않는 처리입니다.';
  end if;
end;
$$;

-- Public availability exposes dates only, never buyer IDs or private requests.
create or replace function public.phase6_rental_availability(p_item_id text)
returns table(start_date date, end_date date)
language sql stable security definer set search_path = '' as $$
  select r.rental_start_date, r.rental_end_date from public.trade_requests r
  join public.items i on i.id = r.item_id
  where i.id::text = p_item_id and i.trade_type = 'RENTAL' and r.status = 'APPROVED';
$$;
revoke all on function public.phase6_rental_availability(text) from public;
grant execute on function public.phase6_rental_availability(text) to anon, authenticated;

revoke all on function public.phase6_request_trade(text, date, date) from public, anon;
revoke all on function public.phase6_update_trade(text, text) from public, anon;
grant execute on function public.phase6_request_trade(text, date, date) to authenticated;
grant execute on function public.phase6_update_trade(text, text) to authenticated;

alter table public.items enable row level security;
alter table public.trade_requests enable row level security;

-- Restrictive policies prevent existing permissive policies from widening access.
-- Direct status changes are disabled: only the guarded transaction functions write them.
drop policy if exists phase6_requests_read_guard on public.trade_requests;
create policy phase6_requests_read_guard on public.trade_requests as restrictive for select to public
  using (auth.uid() is not null and (buyer_id = auth.uid() or exists (select 1 from public.items where items.id = trade_requests.item_id and items.seller_id = auth.uid())));
drop policy if exists phase6_requests_read on public.trade_requests;
create policy phase6_requests_read on public.trade_requests for select to authenticated
  using (buyer_id = auth.uid() or exists (select 1 from public.items where items.id = trade_requests.item_id and items.seller_id = auth.uid()));

drop policy if exists phase6_requests_insert_guard on public.trade_requests;
create policy phase6_requests_insert_guard on public.trade_requests as restrictive for insert to public with check (false);
drop policy if exists phase6_requests_update_guard on public.trade_requests;
create policy phase6_requests_update_guard on public.trade_requests as restrictive for update to public using (false) with check (false);
drop policy if exists phase6_requests_delete_guard on public.trade_requests;
create policy phase6_requests_delete_guard on public.trade_requests as restrictive for delete to public using (false);
drop policy if exists phase6_items_update_guard on public.items;
create policy phase6_items_update_guard on public.items as restrictive for update to public using (false) with check (false);

drop policy if exists phase6_items_read on public.items;
create policy phase6_items_read on public.items for select to anon, authenticated using (true);
drop policy if exists phase6_items_insert_guard on public.items;
create policy phase6_items_insert_guard on public.items as restrictive for insert to public with check (
  auth.uid() is not null and seller_id = auth.uid() and status = 'AVAILABLE'
  and price >= 0 and price = trunc(price) and length(trim(title)) > 0
  and length(trim(description)) > 0 and length(trim(location)) > 0
  and (trade_type = 'SALE' or (trade_type = 'RENTAL' and rental_start_date is not null and rental_end_date is not null and rental_start_date <= rental_end_date))
);
drop policy if exists phase6_items_insert on public.items;
create policy phase6_items_insert on public.items for insert to authenticated with check (seller_id = auth.uid());
grant select on public.items to anon, authenticated;
grant select, insert on public.items to authenticated;
grant select on public.trade_requests to authenticated;
notify pgrst, 'reload schema';
commit;
