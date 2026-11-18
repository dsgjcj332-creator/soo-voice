-- Resolve the authenticated merchant's effective subscription and plan entitlements.
-- No client-supplied owner id is accepted: auth.uid() is the only tenant selector.

begin;

create or replace function public.get_my_billing_entitlements()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_owner_id uuid := auth.uid();
  v_subscription public.merchant_subscriptions%rowtype;
  v_plan public.billing_plans%rowtype;
  v_has_subscription boolean := false;
  v_access boolean := false;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_usage jsonb := '{}'::jsonb;
begin
  if v_owner_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  select * into v_subscription
    from public.merchant_subscriptions
   where owner_id = v_owner_id
   order by created_at desc, id desc
   limit 1;
  v_has_subscription := found;

  if not v_has_subscription then
    return jsonb_build_object(
      'has_subscription', false,
      'access', false,
      'status', 'none',
      'reason', 'subscription_required',
      'plan', null,
      'period', null,
      'usage', '{}'::jsonb
    );
  end if;

  select * into v_plan
    from public.billing_plans
   where id = v_subscription.plan_id;

  v_access :=
    (v_subscription.status = 'active'
      and (v_subscription.current_period_end is null or v_subscription.current_period_end > now()))
    or
    (v_subscription.status = 'trialing'
      and v_subscription.trial_ends_at is not null
      and v_subscription.trial_ends_at > now());

  v_period_start := coalesce(v_subscription.current_period_start, v_subscription.trial_starts_at);
  v_period_end := coalesce(v_subscription.current_period_end, v_subscription.trial_ends_at);

  if v_period_start is not null and v_period_end is not null and v_period_end > v_period_start then
    select coalesce(jsonb_object_agg(metric, quantity), '{}'::jsonb)
      into v_usage
      from (
        select metric, sum(quantity) as quantity
          from public.billing_usage_records
         where owner_id = v_owner_id
           and period_start >= v_period_start
           and period_end <= v_period_end
         group by metric
      ) usage_totals;
  end if;

  return jsonb_build_object(
    'has_subscription', true,
    'access', v_access,
    'status', v_subscription.status,
    'reason', case
      when v_access then null
      when v_subscription.status = 'trialing' then 'trial_expired'
      when v_subscription.status = 'active' then 'subscription_period_ended'
      else 'subscription_inactive'
    end,
    'subscription_id', v_subscription.id,
    'cancel_at_period_end', v_subscription.cancel_at_period_end,
    'plan', case when v_plan.id is null then null else jsonb_build_object(
      'id', v_plan.id,
      'key', v_plan.plan_key,
      'name', v_plan.display_name,
      'features', v_plan.features,
      'usage_limits', v_plan.usage_limits
    ) end,
    'period', case when v_period_start is null and v_period_end is null then null
      else jsonb_build_object('starts_at', v_period_start, 'ends_at', v_period_end) end,
    'usage', v_usage
  );
end;
$function$;

revoke all on function public.get_my_billing_entitlements() from public, anon;
grant execute on function public.get_my_billing_entitlements() to authenticated, service_role;

comment on function public.get_my_billing_entitlements() is
  'Returns the caller own effective subscription, plan feature flags, usage limits and period usage. Never accepts a tenant id from the client.';

commit;
