import { useState } from "react";
import {
  CloudAgentItem,
  CloudAgentsStyles,
  CLOUD_AGENTS,
  type CloudAgentId,
} from "./CloudAgents";

type CharacterProps = {
  activeId: string | null;
  onSelect: (id: string, name: string) => void;
};

export function JellyCharacters({ activeId, onSelect }: CharacterProps) {
  const [hovered, setHovered] = useState<CloudAgentId | null>(null);

  return (
    <div className="flex flex-col items-center select-none">
      <CloudAgentsStyles />

      {/* All 4 distinct cloud agents lined up in a clean horizontal line */}
      <div className="flex items-end justify-center gap-2.5 sm:gap-4.5 pt-3 pb-2">
        {CLOUD_AGENTS.map((agent) => (
          <CloudAgentItem
            key={agent.id}
            id={agent.id}
            size={66}
            isActive={activeId === agent.id}
            onSelect={(id, name) => onSelect(id, name)}
            onHoverChange={(isHov) => setHovered(isHov ? agent.id : null)}
          />
        ))}
      </div>

      {/* Micro-label below characters */}
      <div className="h-5 flex items-center justify-center mt-1">
        {hovered || activeId ? (
          <span className="text-[12.5px] font-medium text-slate-700 transition-opacity animate-in fade-in">
            <span
              className={`font-semibold ${
                CLOUD_AGENTS.find((c) => c.id === (hovered || activeId))
                  ?.labelColor
              }`}
            >
              {CLOUD_AGENTS.find((c) => c.id === (hovered || activeId))?.name}
            </span>{" "}
            ·{" "}
            <span className="text-slate-500">
              {CLOUD_AGENTS.find((c) => c.id === (hovered || activeId))?.role}
            </span>
          </span>
        ) : (
          <span className="text-[12px] text-slate-400 font-medium tracking-wide">
            Pick an agent to start a session
          </span>
        )}
      </div>
    </div>
  );
}
