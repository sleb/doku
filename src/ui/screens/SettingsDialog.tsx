import { useEffect, useRef, useState } from "react";
import { haptics } from "../../platform/haptics";
import {
  type Settings,
  settingsStore,
  useSettingsStore,
} from "../../store/settings";
import { Dialog } from "../Dialog";
import { RadioGroup } from "../RadioGroup";
import { SwitchRow } from "../SwitchRow";

const set = (patch: Partial<Settings>) => settingsStore.getState().set(patch);

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex w-full flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase text-ink-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function SettingsDialog({
  onClose,
  onStartOver,
}: {
  onClose: () => void;
  onStartOver: () => void;
}) {
  const s = useSettingsStore((x) => x);
  const [confirming, setConfirming] = useState(false);
  const startOverButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  // Cancelling unmounts the focused Cancel button; put focus back.
  useEffect(() => {
    if (wasConfirming.current && !confirming) startOverButton.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  return (
    <Dialog
      title="Settings"
      onClose={confirming ? () => setConfirming(false) : onClose}
    >
      <>
        <Section title="Feedback">
          {haptics.supported() && (
            <SwitchRow
              label="Haptics"
              checked={s.haptics}
              onChange={(on) => set({ haptics: on })}
            />
          )}
          <SwitchRow
            label="Sound"
            checked={s.sound}
            onChange={(sound) => set({ sound })}
          />
        </Section>
        <Section title="Display">
          <RadioGroup
            label="Theme"
            value={s.theme}
            options={[
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ]}
            onChange={(theme) => set({ theme })}
          />
          <RadioGroup
            label="Colors"
            value={s.palette}
            options={[
              ["default", "Default"],
              ["accessible", "Color-blind safe"],
            ]}
            onChange={(palette) => set({ palette })}
          />
          <SwitchRow
            label="Patterns"
            checked={s.patterns}
            onChange={(patterns) => set({ patterns })}
          />
        </Section>
        <Section title="Play">
          <SwitchRow
            label="Tap places faces"
            checked={s.inputMode === "face"}
            onChange={(on) => set({ inputMode: on ? "face" : "mark" })}
          />
        </Section>
        {confirming ? (
          <>
            <p>Start over? Your best times are kept.</p>
            <button
              type="button"
              onClick={() => {
                onStartOver();
                onClose();
              }}
              className="rounded bg-accent px-4 py-2 min-h-11 text-on-accent"
            >
              Confirm
            </button>
            <button
              type="button"
              // biome-ignore lint/a11y/noAutofocus: focus must move into the confirm
              autoFocus
              onClick={() => setConfirming(false)}
              className="rounded border border-line px-4 py-2 min-h-11"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            ref={startOverButton}
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded border border-line px-4 py-2 min-h-11"
          >
            Start over
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-accent px-4 py-2 min-h-11 text-on-accent"
        >
          Done
        </button>
      </>
    </Dialog>
  );
}
