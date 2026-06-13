import React, { useRef } from "react";
import { Turnstile } from "react-turnstile";

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
  const turnstileRef = useRef<HTMLDivElement>(null!);

  return (
    <div className="flex justify-center my-4">
      <Turnstile
        userRef={turnstileRef}
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
