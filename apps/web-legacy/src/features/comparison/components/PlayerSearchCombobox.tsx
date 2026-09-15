import { ChevronDown, History } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
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
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedValue = value.trim().toLocaleLowerCase();
  const avatar = playerAvatar(displayValue, side.accent);
  const suggestions = options
    .filter((option) => {
      const normalizedOption = option.toLocaleLowerCase();
      return (
        normalizedOption !== normalizedValue &&
        (normalizedValue.length === 0 ||
          normalizedOption.includes(normalizedValue))
      );
    })
    .slice(0, 6);

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(
        (index) => (index - 1 + suggestions.length) % suggestions.length,
      );
    } else if (event.key === "Enter" && isOpen && suggestions[activeIndex]) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="search-combobox">
      <label className="search-field">
        <span
          className={`mini-avatar ${side.accent}`}
          style={avatar.style}
          aria-hidden="true"
        >
          {avatar.label}
        </span>
        <span className="search-content">
          <small>Player {side.id.toUpperCase()}</small>
          <input
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setActiveIndex(0);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onKeyDown={handleKeyDown}
            aria-label={`Player ${side.id.toUpperCase()} RSN`}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-activedescendant={
              isOpen && suggestions[activeIndex]
                ? `${listboxId}-${activeIndex}`
                : undefined
            }
            role="combobox"
            autoComplete="off"
            name={`player-${side.id}-rsn`}
            spellCheck={false}
          />
        </span>
        <ChevronDown size={15} />
      </label>
      {isOpen && suggestions.length > 0 ? (
        <div className="autocomplete-menu" id={listboxId} role="listbox">
          <span className="autocomplete-heading">
            <History size={11} />
            Recent lookups
          </span>
          {suggestions.map((suggestion, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : ""}
              id={`${listboxId}-${index}`}
              key={suggestion}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <History size={12} />
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
