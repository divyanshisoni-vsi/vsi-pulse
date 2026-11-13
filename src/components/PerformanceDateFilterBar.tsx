"use client";

import React from "react";
import { Calendar } from "lucide-react";
import {
  PERFORMANCE_PRESET_OPTIONS,
  PerformanceDatePreset,
  ResolvedPerformanceRange,
} from "@/lib/performance-analytics";

type Props = {
  preset: PerformanceDatePreset;
  customStart: string;
  customEnd: string;
  resolvedRange: ResolvedPerformanceRange;
  onPresetChange: (preset: PerformanceDatePreset) => void;
  onCustomStartChange: (val: string) => void;
  onCustomEndChange: (val: string) => void;
};

function PerformanceDateFilterBarComponent({
  preset,
  customStart,
  customEnd,
  resolvedRange,
  onPresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: Props) {
  return (
    <div className="perf-filter-bar">
      <div className="perf-filter-left">
        <span className="perf-filter-title">
          <Calendar size={14} />
          <span>Tracking Period:</span>
        </span>
        <div className="perf-preset-pills">
          {PERFORMANCE_PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`perf-preset-btn ${
                preset === opt.value ? "active" : ""
              }`}
              onClick={() => onPresetChange(opt.value)}
              title={opt.label}
            >
              {opt.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="perf-filter-right">
        {preset === "custom" && (
          <div className="perf-custom-dates">
            <label>
              <span>From</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => onCustomStartChange(e.target.value)}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => onCustomEndChange(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="perf-range-pill" title={resolvedRange.label}>
          <strong>{resolvedRange.shortLabel}</strong>
          {resolvedRange.startDate && resolvedRange.endDate && (
            <span>
              {resolvedRange.startDate} to {resolvedRange.endDate}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(PerformanceDateFilterBarComponent);
