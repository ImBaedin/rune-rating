import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

type Choice = { value: string; label: string; icon?: ReactNode };
type Preset = {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

export function SearchMultiSelect({
  label,
  summary,
  items,
  value,
  onChange,
  presets,
  searchLabel,
  placeholder,
  emptyMessage,
  minSelections = 0,
}: {
  label: string;
  summary: string;
  items: Choice[];
  value: string[];
  onChange: (value: string[]) => void;
  presets: Preset[];
  searchLabel: string;
  placeholder: string;
  emptyMessage: string;
  minSelections?: number;
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedItems = items.filter((item) => value.includes(item.value));
  return (
    <Combobox.Root
      multiple
      items={items}
      value={selectedItems}
      isItemEqualToValue={(a, b) => a.value === b.value}
      onValueChange={(next, details) => {
        if (next.length < minSelections) {
          details.cancel();
          return;
        }
        onChange(next.map((item) => item.value));
      }}
      inputValue={query}
      onInputValueChange={(next, details) => {
        if (!details.isItemPress) setQuery(next);
      }}
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) setQuery("");
      }}
    >
      <Combobox.Trigger
        className="rr-metric-trigger"
        aria-label={`${label}: ${summary}`}
      >
        <span>{label}</span>
        <strong>{summary}</strong>
        <ChevronDown size={14} aria-hidden="true" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner
          className="rr-popup-positioner"
          sideOffset={6}
          align="end"
        >
          <Combobox.Popup
            className="rr-popup rr-metric-popup"
            aria-label={label}
          >
            <fieldset
              className="rr-picker-presets"
              aria-label={`${label} presets`}
            >
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={preset.selected}
                  onClick={() => {
                    preset.onSelect();
                    setOpen(false);
                  }}
                >
                  <span>
                    <strong>{preset.label}</strong>
                    <small>{preset.description}</small>
                  </span>
                  {preset.selected ? (
                    <Check size={13} aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </fieldset>
            <label className="rr-picker-search" htmlFor={inputId}>
              <Search size={14} aria-hidden="true" />
              <Combobox.Input
                id={inputId}
                aria-label={searchLabel}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <Combobox.Empty className="rr-popup-empty">
              {emptyMessage}
            </Combobox.Empty>
            <Combobox.List className="rr-popup-list rr-metric-list">
              {(item: Choice) => (
                <Combobox.Item
                  className="rr-option"
                  key={item.value}
                  value={item}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  <Combobox.ItemIndicator className="rr-option-check">
                    <Check size={13} />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
