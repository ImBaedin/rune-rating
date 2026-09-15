import { Check, Clock3 } from "lucide-react";

export function ShellSourceChip({
  label,
  status,
  detail,
}: {
  label: string;
  status: "live" | "delayed" | "off";
  detail?: string | null;
}) {
  return (
    <span className={`source-chip ${status}`}>
      <i>{status === "live" ? <Check size={9} /> : <Clock3 size={9} />}</i>
      {label}
      {detail ? <small>{detail}</small> : null}
    </span>
  );
}
