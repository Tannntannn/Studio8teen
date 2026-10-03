-- Attach older payment alerts to the booking created a few seconds earlier.

UPDATE public.notifications AS n
SET
  booking_id = sub.booking_id,
  link = sub.link
FROM (
  SELECT
    n2.id,
    p.booking_id,
    CASE
      WHEN pr.role = 'admin' THEN '/admin/bookings/' || p.booking_id::text
      ELSE '/client-bookings/' || p.booking_id::text
    END AS link
  FROM public.notifications n2
  JOIN public.profiles pr ON pr.id = n2.user_id
  JOIN LATERAL (
    SELECT pay.booking_id
    FROM public.payments pay
    WHERE abs(extract(epoch FROM (pay.created_at - n2.created_at))) < 20
    ORDER BY abs(extract(epoch FROM (pay.created_at - n2.created_at)))
    LIMIT 1
  ) p ON TRUE
  WHERE n2.booking_id IS NULL
    AND n2.link IS NULL
    AND (
      n2.message ILIKE '%payment proof%'
      OR n2.message ILIKE '%waiting for you to confirm%'
      OR n2.message ILIKE '%Payment received%'
      OR n2.message ILIKE '%Payment verified%'
    )
) AS sub
WHERE n.id = sub.id;
