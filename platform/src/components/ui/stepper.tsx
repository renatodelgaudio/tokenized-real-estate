import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  current: number;
  accent?: string;
}

export function Stepper({ steps, current, accent = "#6366f1" }: StepperProps) {
  return (
    <div className="flex items-start gap-0">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300",
                  done && "text-white",
                  active && "text-white ring-4 ring-opacity-20",
                  !done && !active && "bg-slate-100 text-slate-400"
                )}
                style={{
                  backgroundColor: done || active ? accent : undefined,
                }}
              >
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-xs font-medium leading-tight text-center max-w-[72px]",
                  active ? "text-slate-900" : done ? "text-slate-600" : "text-slate-400"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-1 mt-4 h-0.5 flex-1 rounded-full transition-all duration-300"
                style={{ backgroundColor: i < current ? accent : "#e2e8f0" }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
