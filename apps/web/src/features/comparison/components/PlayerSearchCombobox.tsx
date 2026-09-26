import { Autocomplete } from "@base-ui/react/autocomplete";
import { ChevronDown, History } from "lucide-react";
import { useId } from "react";
import { type PlayerAccent, playerAvatar } from "../playerIdentity";

export function PlayerSearchCombobox({
  side,
  value,
  displayValue = value,
  options,
  onChange,
}: {
  side: { id: "a" | "b"; accent: PlayerAccent };
  value: string;
  displayValue?: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  const normalizedValue = value.trim().toLocaleLowerCase();
  const avatar = playerAvatar(displayValue, side.accent);
  const suggestions = options
    .filter((option) => {
      const normalizedOption = option.toLocaleLowerCase();
      return (
        normalizedOption !== normalizedValue &&
        normalizedOption.includes(normalizedValue)
      );
    })
    .slice(0, 6);

  return (
    <Autocomplete.Root
      items={suggestions}
      filter={null}
      value={value}
      onValueChange={onChange}
      openOnInputClick
    >
      <Autocomplete.InputGroup className="search-combobox">
        <label className="search-field" htmlFor={inputId}>
          <span
            className={`mini-avatar ${side.accent}`}
            style={avatar.style}
            aria-hidden="true"
          >
            {avatar.label}
          </span>
          <span className="search-content">
            <small>Player {side.id.toUpperCase()}</small>
            <Autocomplete.Input
              id={inputId}
              aria-label={`Player ${side.id.toUpperCase()} RSN`}
              autoComplete="off"
              name={`player-${side.id}-rsn`}
              spellCheck={false}
            />
          </span>
        </label>
        <Autocomplete.Trigger
          className="rr-autocomplete-trigger"
          aria-label={`Recent players for Player ${side.id.toUpperCase()}`}
        >
          <ChevronDown size={15} aria-hidden="true" />
        </Autocomplete.Trigger>
      </Autocomplete.InputGroup>
      <Autocomplete.Portal>
        <Autocomplete.Positioner
          className="rr-popup-positioner"
          sideOffset={6}
          align="start"
        >
          <Autocomplete.Popup className="rr-popup rr-autocomplete-popup">
            <div className="rr-popup-heading">
              <History size={12} aria-hidden="true" />
              Recent lookups
            </div>
            <Autocomplete.Empty className="rr-popup-empty">
              No recent matches. Enter any RSN.
            </Autocomplete.Empty>
            <Autocomplete.List className="rr-popup-list">
              {(suggestion: string) => (
                <Autocomplete.Item
                  className="rr-option"
                  key={suggestion}
                  value={suggestion}
                >
                  <History size={12} aria-hidden="true" />
                  {suggestion}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
