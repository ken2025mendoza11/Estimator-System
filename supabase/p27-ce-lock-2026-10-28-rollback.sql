-- Step 27 rollback. Restores the Phase 1B task-only guard. Does not drop stored columns.

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
  old_locked boolean;
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

  if p_kind = 'ce' and old_payload is not null then
    old_locked := lower(coalesce(old_payload #>> '{document,approval,status}', old_payload #>> '{summary,approval,status}', '')) = 'accepted'
      or lower(coalesce(old_payload #>> '{summary,status}', old_payload #>> '{document,ceStatus}', '')) in ('done', 'accepted');
    if old_locked and (old_payload #> '{document,tasks}') is distinct from (new_payload #> '{document,tasks}') then
      return 'Approved estimates cannot change tasks.';
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

revoke all on function public.doc_write_guard(text, jsonb, jsonb) from public, anon;
grant execute on function public.doc_write_guard(text, jsonb, jsonb) to authenticated;

drop function if exists public.ce_revision_start(jsonb, jsonb);
drop function if exists public.caller_is_sales();
drop function if exists public.ce_payload_locked(jsonb);
drop function if exists public.ce_status_ok(text, text);
drop function if exists public.ce_strip_lock_noise(jsonb);
drop function if exists public.ce_strip_editor_defaults(jsonb, jsonb);
drop function if exists public.ce_normalize_commercial(jsonb, jsonb);
drop function if exists public.ce_percent_text(jsonb, text);
drop function if exists public.ce_drop_empty_additions(jsonb, jsonb);
drop function if exists public.ce_json_empty(jsonb);
