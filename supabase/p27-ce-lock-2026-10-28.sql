-- Step 27. Apply after p26-departments-approvers-2026-10-28.sql.
-- Apply on the TEST project first. The app keeps working when this file has not been applied.
-- Replaces public.doc_write_guard only. Does not retype columns and does not rewrite stored rows.
-- An approved cost estimate cannot change, except a non-sales revision start.
-- Sales is account_department = 'Sales', or a blank fixed department with free-text department exactly 'sales'.

create or replace function public.ce_json_empty(value jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  key text;
begin
  if value is null or value = 'null'::jsonb or value = '""'::jsonb or value = '[]'::jsonb or value = '{}'::jsonb or value = 'false'::jsonb then
    return true;
  end if;
  if jsonb_typeof(value) = 'object' then
    for key in select jsonb_object_keys(value)
    loop
      if not public.ce_json_empty(value -> key) then
        return false;
      end if;
    end loop;
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.ce_drop_empty_additions(old_value jsonb, new_value jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  key text;
  out jsonb := '{}'::jsonb;
begin
  if new_value is null or jsonb_typeof(new_value) <> 'object' then
    return new_value;
  end if;
  for key in select jsonb_object_keys(new_value)
  loop
    if old_value is null or jsonb_typeof(old_value) <> 'object' or not (old_value ? key) then
      if public.ce_json_empty(new_value -> key) then
        continue;
      end if;
      out := out || jsonb_build_object(key, new_value -> key);
    else
      out := out || jsonb_build_object(key, public.ce_drop_empty_additions(old_value -> key, new_value -> key));
    end if;
  end loop;
  return out;
end;
$$;

create or replace function public.ce_normalize_commercial(old_doc jsonb, new_doc jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  commercial jsonb := new_doc -> 'commercial';
  cont text;
  disc text;
  days text;
begin
  if new_doc is null or old_doc ? 'commercial' or commercial is null or jsonb_typeof(commercial) <> 'object' then
    return new_doc;
  end if;
  cont := coalesce(commercial ->> 'contingencyPct', '0');
  disc := coalesce(commercial ->> 'discountPct', '0');
  days := commercial ->> 'validityDays';
  if cont in ('0', '0.0', '0.00') and disc in ('0', '0.0', '0.00') and (days is null or days in ('30', '30.0')) then
    return new_doc - 'commercial';
  end if;
  return new_doc;
end;
$$;

create or replace function public.ce_percent_text(doc jsonb, key text)
returns text
language plpgsql
immutable
as $$
declare
  raw text := doc #>> array['commercial', key];
  n numeric;
begin
  if raw is null or btrim(raw) = '' then
    return '0';
  end if;
  n := btrim(raw)::numeric;
  return trim(to_char(n, 'FM999999999999990.999999'));
exception when others then
  return btrim(raw);
end;
$$;

create or replace function public.ce_strip_editor_defaults(old_doc jsonb, new_doc jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb := new_doc;
  show jsonb;
begin
  if result is null then
    return result;
  end if;
  result := public.ce_normalize_commercial(old_doc, result);
  if not (old_doc ? 'thirdPartyShow') and result ? 'thirdPartyShow' then
    show := result -> 'thirdPartyShow';
    if show = '{"mode":"off","keys":[]}'::jsonb or show = '{"keys":[],"mode":"off"}'::jsonb or show = '{"mode":"off"}'::jsonb then
      result := result - 'thirdPartyShow';
    end if;
  end if;
  if result ? 'meta' and jsonb_typeof(result -> 'meta') = 'object' then
    if old_doc is null or jsonb_typeof(old_doc -> 'meta') <> 'object' or not ((old_doc -> 'meta') ? 'date') then
      result := jsonb_set(result, '{meta}', (result -> 'meta') - 'date');
    end if;
    if old_doc is null or jsonb_typeof(old_doc -> 'meta') <> 'object' or not ((old_doc -> 'meta') ? 'subtitle') then
      result := jsonb_set(result, '{meta}', (result -> 'meta') - 'subtitle');
    end if;
    if (old_doc is null or jsonb_typeof(old_doc -> 'meta') <> 'object' or not ((old_doc -> 'meta') ? 'title'))
       and coalesce(result #>> '{meta,title}', '') in ('', 'New Cost Estimate') then
      result := jsonb_set(result, '{meta}', (result -> 'meta') - 'title');
    end if;
    if (old_doc is null or jsonb_typeof(old_doc -> 'meta') <> 'object' or not ((old_doc -> 'meta') ? 'client'))
       and coalesce(result #>> '{meta,client}', '') = '' then
      result := jsonb_set(result, '{meta}', (result -> 'meta') - 'client');
    end if;
    if (old_doc is null or jsonb_typeof(old_doc -> 'meta') <> 'object' or not ((old_doc -> 'meta') ? 'location'))
       and coalesce(result #>> '{meta,location}', '') = '' then
      result := jsonb_set(result, '{meta}', (result -> 'meta') - 'location');
    end if;
  end if;
  return result;
end;
$$;

create or replace function public.ce_strip_lock_noise(payload jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  doc jsonb := payload -> 'document';
  summary jsonb := payload -> 'summary';
  info jsonb;
begin
  if doc is not null and jsonb_typeof(doc) = 'object' then
    doc := doc - array['timeline', 'lastEdited', 'lastEditedBy', 'schedule', 'ceStatus', 'status'];
    info := doc -> 'projectInfo';
    if info is not null and jsonb_typeof(info) = 'object' then
      doc := jsonb_set(doc, '{projectInfo}', info - array['revisionPending', 'revisionNote']);
    end if;
  end if;
  if summary is not null and jsonb_typeof(summary) = 'object' then
    summary := summary - array['timeline', 'lastEdited', 'lastEditedBy', 'status', 'client', 'project', 'isNew'];
  end if;
  return jsonb_build_object('summary', summary, 'document', doc);
end;
$$;

create or replace function public.ce_status_ok(old_status text, new_status text)
returns boolean
language sql
immutable
as $$
  select coalesce(trim(new_status), '') = ''
    or lower(trim(new_status)) = lower(trim(coalesce(old_status, '')))
    or lower(trim(new_status)) = 'for revision';
$$;

create or replace function public.ce_payload_locked(payload jsonb)
returns boolean
language sql
immutable
as $$
  select payload is not null and (
    lower(coalesce(payload #>> '{document,approval,status}', payload #>> '{summary,approval,status}', '')) = 'accepted'
    or lower(coalesce(payload #>> '{summary,status}', payload #>> '{document,ceStatus}', '')) in ('done', 'accepted')
  );
$$;

create or replace function public.caller_is_sales()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_fixed boolean;
begin
  if auth.uid() is null then
    return false;
  end if;
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_user_roles'
      and column_name = 'account_department'
  ) into has_fixed;
  if has_fixed then
    return exists (
      select 1
      from public.app_user_roles roles
      where roles.status = 'active'
        and roles.user_key = auth.uid()::text
        and (
          roles.account_department = 'Sales'
          or (
            roles.account_department is null
            and lower(trim(coalesce(roles.department, ''))) = 'sales'
          )
        )
    );
  end if;
  return exists (
    select 1
    from public.app_user_roles roles
    where roles.status = 'active'
      and roles.user_key = auth.uid()::text
      and lower(trim(coalesce(roles.department, ''))) = 'sales'
  );
end;
$$;

create or replace function public.ce_revision_start(old_payload jsonb, new_payload jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  old_doc jsonb := coalesce(old_payload -> 'document', '{}'::jsonb);
  new_doc jsonb := coalesce(new_payload -> 'document', '{}'::jsonb);
  old_sum jsonb := old_payload -> 'summary';
  new_sum jsonb := new_payload -> 'summary';
  moved boolean := false;
  cleaned_old jsonb;
  cleaned_new jsonb;
begin
  if not public.ce_status_ok(old_doc ->> 'ceStatus', new_doc ->> 'ceStatus') then
    return false;
  end if;
  if not public.ce_status_ok(old_doc ->> 'status', new_doc ->> 'status') then
    return false;
  end if;
  if not public.ce_status_ok(old_sum ->> 'status', new_sum ->> 'status') then
    return false;
  end if;
  if lower(trim(coalesce(new_doc ->> 'ceStatus', ''))) = 'for revision'
     and lower(trim(coalesce(old_doc ->> 'ceStatus', ''))) is distinct from 'for revision' then
    moved := true;
  end if;
  if lower(trim(coalesce(new_doc ->> 'status', ''))) = 'for revision'
     and lower(trim(coalesce(old_doc ->> 'status', ''))) is distinct from 'for revision' then
    moved := true;
  end if;
  if lower(trim(coalesce(new_sum ->> 'status', ''))) = 'for revision'
     and lower(trim(coalesce(old_sum ->> 'status', ''))) is distinct from 'for revision' then
    moved := true;
  end if;
  if coalesce(new_doc #> '{projectInfo,revisionPending}', 'false'::jsonb) = 'true'::jsonb
     and coalesce(old_doc #> '{projectInfo,revisionPending}', 'false'::jsonb) is distinct from 'true'::jsonb then
    moved := true;
  end if;
  if not moved then
    return false;
  end if;
  if public.ce_percent_text(old_doc, 'contingencyPct') is distinct from public.ce_percent_text(new_doc, 'contingencyPct') then
    return false;
  end if;
  if public.ce_percent_text(old_doc, 'discountPct') is distinct from public.ce_percent_text(new_doc, 'discountPct') then
    return false;
  end if;
  if coalesce(old_doc ->> 'awardStatus', '') is distinct from coalesce(new_doc ->> 'awardStatus', '') then
    return false;
  end if;
  if coalesce(old_doc ->> 'awardJo', '') is distinct from coalesce(new_doc ->> 'awardJo', '') then
    return false;
  end if;
  new_doc := public.ce_strip_editor_defaults(old_doc, new_doc);
  cleaned_old := public.ce_strip_lock_noise(jsonb_build_object('summary', old_sum, 'document', old_doc));
  cleaned_new := public.ce_strip_lock_noise(jsonb_build_object(
    'summary', case when new_sum is null then null else public.ce_drop_empty_additions(coalesce(old_sum, '{}'::jsonb), new_sum) end,
    'document', public.ce_drop_empty_additions(old_doc, new_doc)
  ));
  return cleaned_old = cleaned_new;
end;
$$;

create or replace function public.doc_write_guard(p_kind text, old_payload jsonb, new_payload jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  msg text;
  new_status text;
  new_approval text;
begin
  new_status := lower(trim(coalesce(
    new_payload #>> '{summary,status}',
    new_payload #>> '{document,ceStatus}',
    new_payload ->> 'status',
    ''
  )));
  new_approval := lower(trim(coalesce(
    new_payload #>> '{document,approval,status}',
    new_payload #>> '{summary,approval,status}',
    new_payload #>> '{approval,status}',
    ''
  )));
  if new_status = 'done' and new_approval is distinct from 'accepted' then
    return 'Done is only available after the approval is accepted.';
  end if;

  if p_kind = 'ce' and old_payload is not null and public.ce_payload_locked(old_payload) then
    if old_payload is distinct from new_payload then
      if public.caller_is_sales() or not public.ce_revision_start(old_payload, new_payload) then
        return 'Approved estimates cannot be changed.';
      end if;
    end if;
  end if;

  msg := public.approval_signature_error(old_payload -> 'approval', new_payload -> 'approval');
  if msg is not null then
    return msg;
  end if;
  msg := public.approval_signature_error(old_payload #> '{document,approval}', new_payload #> '{document,approval}');
  if msg is not null then
    return msg;
  end if;
  msg := public.approval_signature_error(old_payload #> '{summary,approval}', new_payload #> '{summary,approval}');
  return msg;
end;
$$;

revoke all on function public.ce_percent_text(jsonb, text) from public, anon;
revoke all on function public.ce_json_empty(jsonb) from public, anon;
revoke all on function public.ce_drop_empty_additions(jsonb, jsonb) from public, anon;
revoke all on function public.ce_normalize_commercial(jsonb, jsonb) from public, anon;
revoke all on function public.ce_strip_editor_defaults(jsonb, jsonb) from public, anon;
revoke all on function public.ce_strip_lock_noise(jsonb) from public, anon;
revoke all on function public.ce_status_ok(text, text) from public, anon;
revoke all on function public.ce_payload_locked(jsonb) from public, anon;
revoke all on function public.caller_is_sales() from public, anon;
revoke all on function public.ce_revision_start(jsonb, jsonb) from public, anon;
revoke all on function public.doc_write_guard(text, jsonb, jsonb) from public, anon;
grant execute on function public.doc_write_guard(text, jsonb, jsonb) to authenticated;

do $$
declare
  body text;
  sales_body text;
begin
  if to_regprocedure('public.doc_write_guard(text, jsonb, jsonb)') is null then
    raise exception 'FAIL: doc_write_guard missing';
  end if;
  body := pg_get_functiondef(to_regprocedure('public.doc_write_guard(text, jsonb, jsonb)'));
  sales_body := pg_get_functiondef(to_regprocedure('public.caller_is_sales()'));
  if position('Approved estimates cannot be changed.' in body) = 0 then
    raise exception 'FAIL: approved lock message missing';
  end if;
  if position('Approved estimates cannot change tasks.' in body) > 0 then
    raise exception 'FAIL: tasks-only lock is still the guard';
  end if;
  if position('caller_is_sales' in body) = 0 or position('ce_revision_start' in body) = 0 then
    raise exception 'FAIL: sales or revision check missing';
  end if;
  if position('approval_signature_error' in body) = 0 then
    raise exception 'FAIL: signature check removed';
  end if;
  if position('Done is only available after the approval is accepted.' in body) = 0 then
    raise exception 'FAIL: done check removed';
  end if;
  if position('account_department' in sales_body) = 0 then
    raise exception 'FAIL: sales check ignores the fixed department';
  end if;
  if position('user_key = auth.uid()' in sales_body) = 0 then
    raise exception 'FAIL: sales check does not use the signed-in account';
  end if;
end;
$$;
