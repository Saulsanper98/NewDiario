import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, suffix, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const errorId = error && inputId ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-white/60 uppercase tracking-wide"
          >
            {label}
            {props.required && (
              <span className="text-red-400/80 ml-0.5" aria-hidden>*</span>
            )}
          </label>
        )}
        <div className="relative overflow-hidden rounded-lg">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-describedby={errorId}
            aria-invalid={!!error}
            className={cn(
              "w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30",
              "focus:outline-none focus:border-[#ffeb66]/50 focus:bg-white/7 focus:ring-1 focus:ring-[#ffeb66]/40",
              "transition-all duration-200 h-9 px-3",
              icon && "pl-9",
              (suffix || error) && "pr-9",
              error && "border-red-500/50 focus:border-red-500/70",
              className
            )}
            {...props}
          />
          {error ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400/70 pointer-events-none">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          ) : suffix ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-white/40">
              {suffix}
            </div>
          ) : null}
          <span className="input-focus-bar" aria-hidden="true" />
        </div>
        {error && (
          <p key={error} id={errorId} role="alert" className="text-xs text-red-400 flex items-center gap-1 animate-in slide-in-from-top-1 duration-150">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
