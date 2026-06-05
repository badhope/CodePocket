"use client";

import { useFeatureGate, type FeatureId } from "@/lib/system/feature-gate";
import { LockedOverlay } from "@/components/system/locked-overlay";

export function BackendGate({
  feature,
  children,
  preview,
}: {
  feature: FeatureId;
  children?: React.ReactNode;
  preview?: React.ReactNode;
}) {
  const gate = useFeatureGate(feature);
  if (gate.enabled) return <>{children}</>;
  return <LockedOverlay feature={feature}>{preview}</LockedOverlay>;
}
