import React, { useRef } from "react";
import { Turnstile, TurnstileInstance } from "react-turnstile";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onVerify,
  onError,
  onExpire,
}) => {
  const turnstileRef = useRef<TurnstileInstance>(null);

  return (
    <div className="flex justify-center my-4">
      <Turnstile
        ref={turnstileRef}
        sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
        onVerify={onVerify}
        onError={onError}
        onExpire={onExpire}
        theme="dark"
        size="normal"
      />
    </div>
  );
};

export const getTurnstileInstance = (ref: React.RefObject<TurnstileInstance>) => {
  return ref.current;
};
