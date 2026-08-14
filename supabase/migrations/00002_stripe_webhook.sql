-- Function to handle Stripe webhook events
CREATE OR REPLACE FUNCTION public.handle_stripe_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update purchase status when Stripe session completes
  UPDATE public.purchases
  SET status = NEW.status,
      stripe_session_id = NEW.stripe_session_id
  WHERE stripe_session_id = NEW.stripe_session_id;
  
  RETURN NEW;
END;
$$;
