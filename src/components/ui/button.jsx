import { cn } from "../../lib/utils";

const variants = {
  default: "bg-rose-600 text-white hover:bg-rose-700",
  outline: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
};

export function Button({ className, variant = "default", ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500",
        variants[variant] || variants.default,
        className,
      )}
      {...props}
    />
  );
}
