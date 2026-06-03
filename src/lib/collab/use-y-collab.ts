// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { colorFromId } from "./colors";

export type CollabStatus = "disconnected" | "connecting" | "connected" | "error";

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  clientId: number;
}

export interface UseYCollabOptions {
  roomId: string | null;
  userId: string;
  userName: string;
  url?: string;
  enabled?: boolean;
}

export interface UseYCollabResult {
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  status: CollabStatus;
  users: CollabUser[];
  error: string | null;
}

function getDefaultUrl(): string | undefined {
  const envUrl = process.env.NEXT_PUBLIC_COLLAB_URL;
  if (envUrl && envUrl.length > 0) return envUrl.replace(/\/+$/, "");
  return undefined;
}

export function useYCollab(options: UseYCollabOptions): UseYCollabResult {
  const { roomId, userId, userName, url, enabled = true } = options;
  const serverUrl = useMemo(() => url ?? getDefaultUrl(), [url]);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const [status, setStatus] = useState<CollabStatus>("disconnected");
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !roomId || !serverUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("disconnected");
      return;
    }

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new HocuspocusProvider({
      url: serverUrl,
      name: roomId,
      document: ydoc,
      token: userId,
      onStatus: ({ status: s }) => {
        if (s === "connected") setStatus("connected");
        else if (s === "connecting") setStatus("connecting");
        else setStatus("disconnected");
      },
      onAuthenticated: () => {
        setStatus("connected");
        setError(null);
      },
      onAuthenticationFailed: ({ reason }) => {
        setStatus("error");
        setError(reason || "auth_failed");
      },
      onClose: () => setStatus("disconnected"),
    });
    providerRef.current = provider;

    // Handle connection errors via status listener
    provider.on("status", ({ status: s }: { status: string }) => {
      if (s === "error" || s === "disconnected") {
        setStatus("error");
        setError("connection_error");
      }
    });

    const awareness = provider.awareness;
    if (awareness) {
      const color = colorFromId(userId);
      awareness.setLocalStateField("user", {
        id: userId,
        name: userName,
        color,
        clientId: awareness.clientID,
      });
      const onChange = () => {
        const states = Array.from(awareness.getStates().entries());
        const list: CollabUser[] = states
          .map(([clientId, state]) => {
            const u = (state as { user?: { id: string; name: string; color: string } }).user;
            if (!u) return null;
            return { id: u.id, name: u.name, color: u.color, clientId };
          })
          .filter((u): u is CollabUser => !!u);
        setUsers(list);
      };
      awareness.on("change", onChange);
      onChange();
      provider.on("synced", onChange);
      return () => {
        awareness.off("change", onChange);
        provider.off("synced", onChange);
        provider.disconnect();
        provider.destroy();
        ydoc.destroy();
        ydocRef.current = null;
        providerRef.current = null;
      };
    }

    return () => {
      provider.disconnect();
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      providerRef.current = null;
    };
  }, [enabled, roomId, serverUrl, userId, userName]);

  /* eslint-disable react-hooks/refs */
  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    status,
    users,
    error,
  };
  /* eslint-enable react-hooks/refs */
}
