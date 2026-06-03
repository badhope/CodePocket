// @ts-nocheck
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
import { CollabStatus, CollabUser } from "@/lib/collab";

export interface CollabPresenceProps {
  users: CollabUser[];
  status: CollabStatus;
  selfId?: string;
  className?: string;
}

const STATUS_LABEL: Record<CollabStatus, string> = {
  disconnected: "Offline",
  connecting: "Connecting…",
  connected: "Live",
  error: "Error",
};

const STATUS_COLOR: Record<CollabStatus, string> = {
  disconnected: "bg-muted-foreground/40",
  connecting: "bg-yellow-500 animate-pulse",
  connected: "bg-emerald-500",
  error: "bg-red-500",
};

export function CollabPresence({ users, status, selfId, className }: CollabPresenceProps) {
  const visible = users.slice(0, 5);
  const overflow = users.length - visible.length;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn("inline-block h-2 w-2 rounded-full", STATUS_COLOR[status])}
            aria-label={`Collab ${STATUS_LABEL[status]}`}
          />
        </TooltipTrigger>
        <TooltipContent>{STATUS_LABEL[status]}</TooltipContent>
      </Tooltip>
      <div className="flex -space-x-2">
        {visible.map((u) => (
          <Tooltip key={u.clientId}>
            <TooltipTrigger asChild>
              <Avatar
                className="border-background h-6 w-6 border-2"
                style={{ boxShadow: `0 0 0 1px ${u.color}` }}
              >
                <AvatarFallback
                  className="text-[10px] font-semibold text-white"
                  style={{ backgroundColor: u.color }}
                >
                  {initialsFromName(u.name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              {u.name}
              {selfId && u.id === selfId ? " (you)" : ""}
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <Avatar className="border-background h-6 w-6 border-2">
            <AvatarFallback className="text-[10px]">+{overflow}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
