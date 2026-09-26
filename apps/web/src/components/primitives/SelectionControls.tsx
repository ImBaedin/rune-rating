import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Select } from "@base-ui/react/select";
import { Slider } from "@base-ui/react/slider";
import { Check, ChevronDown } from "lucide-react";

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <RadioGroup
      aria-label={label}
      className={`rr-segmented ${className}`.trim()}
      value={value}
      onValueChange={onChange}
    >
      {options.map(([option, text]) => (
        <Radio.Root
          key={option}
          value={option}
          nativeButton
          render={<button type="button" />}
          className={value === option ? "active" : ""}
        >
          {text}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  compact = false,
  className = "",
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Select.Root
      value={value}
      items={options.map(([value, label]) => ({ value, label }))}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <Select.Trigger
        aria-label={label}
        className={`rr-select-field rr-select-trigger ${compact ? "compact" : ""} ${className}`.trim()}
      >
        <span>{label}</span>
        <Select.Value className="rr-select-value" />
        <Select.Icon>
          <ChevronDown size={14} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className="rr-popup-positioner"
          sideOffset={6}
          align="start"
          alignItemWithTrigger={false}
        >
          <Select.Popup className="rr-popup rr-select-popup">
            <Select.List className="rr-popup-list">
              {options.map(([option, text]) => (
                <Select.Item className="rr-option" key={option} value={option}>
                  <Select.ItemText>{text}</Select.ItemText>
                  <Select.ItemIndicator className="rr-option-check">
                    <Check size={13} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export function ValueSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
}) {
  return (
    <Slider.Root
      className="rr-slider"
      value={value}
      min={min}
      max={max}
      step={step}
      onValueChange={onChange}
    >
      <Slider.Control className="rr-slider-control">
        <Slider.Track className="rr-slider-track">
          <Slider.Indicator className="rr-slider-fill" />
        </Slider.Track>
        <Slider.Thumb
          className="rr-slider-thumb"
          aria-label={label}
          getAriaValueText={(value) => `${value}${unit ? ` ${unit}` : ""}`}
        />
      </Slider.Control>
    </Slider.Root>
  );
}
