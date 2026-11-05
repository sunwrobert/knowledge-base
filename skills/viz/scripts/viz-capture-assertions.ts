import type { VizTheme } from "./viz-token-source";

export type CaptureRecord = {
  asset: string;
  sha256: string;
  theme: VizTheme;
  themeProbe: string;
};

export function assertThemeCapturesDiffer(
  records: readonly CaptureRecord[],
  asset: string
): void {
  const light = records.find(
    (record) => record.asset === asset && record.theme === "light"
  );
  const dark = records.find(
    (record) => record.asset === asset && record.theme === "dark"
  );
  if (
    !light ||
    !dark ||
    light.sha256 === dark.sha256 ||
    light.themeProbe === dark.themeProbe
  ) {
    throw new Error(
      `Theme assertion failed for ${asset}: light and dark captures are identical`
    );
  }
}
